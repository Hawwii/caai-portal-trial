from progressbar import progressbar
import pandas as pd
import helpers.db as dbutils
import helpers.cleaning as data_cleaning_utils
import helpers.metrics as metrics
import helpers.structured as structured
import scipy.stats as stats
from helpers.constants import *
from numpy import std, mean, sqrt
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import string
import nltk

def compute_ssvs_scores(df_ssvs):
    # Compute conservation score
    df_ssvs['conservation'] = (
        0.92 +
        0.15 * df_ssvs['ssvs_power'] +
        0.03 * df_ssvs['ssvs_achievement'] -
        0.17 * df_ssvs['ssvs_hedonism'] -
        0.25 * df_ssvs['ssvs_stimulation'] -
        0.31 * df_ssvs['ssvs_self-direction'] -
        0.26 * df_ssvs['ssvs_universalism'] +
        0.04 * df_ssvs['ssvs_benevolence'] +
        0.30 * df_ssvs['ssvs_tradition'] +
        0.30 * df_ssvs['ssvs_conformity'] +
        0.20 * df_ssvs['ssvs_security']
    )

    # Compute self-transcendence score
    df_ssvs['transcendence'] = (
        -0.56 -
        0.30 * df_ssvs['ssvs_power'] -
        0.33 * df_ssvs['ssvs_achievement'] -
        0.16 * df_ssvs['ssvs_hedonism'] -
        0.14 * df_ssvs['ssvs_stimulation'] +
        0.04 * df_ssvs['ssvs_self-direction'] +
        0.22 * df_ssvs['ssvs_universalism'] +
        0.24 * df_ssvs['ssvs_benevolence'] +
        0.12 * df_ssvs['ssvs_tradition'] +
        0.03 * df_ssvs['ssvs_conformity'] +
        0.03 * df_ssvs['ssvs_security']
    )

    return df_ssvs

def construct_dfs_for_analysis(users_df, EVENTS_DIR, TREATMENT_LABEL, CONTROL_LABEL):
    '''
    Construct dataframes for analysis
    '''

    events_dfs = []
    tasks_dfs = []
    suggestions_dfs = []

    for user_id in progressbar(users_df.index.unique()):
        events = dbutils.load_events_for_user(user_id, EVENTS_DIR)
        events_df = data_cleaning_utils.create_events_df(events)
        tasks_df = data_cleaning_utils.create_task_df_for_user(events_df)
        tasks_df = tasks_df.drop('attention_check')
        if 'tutorial' in tasks_df.index:
            tasks_df = tasks_df.drop('tutorial')

        # Set control/treatment group in users_df
        show_suggestion = events_df[events_df['eventName'] == 'study_started'].iloc[0]['eventDetails']['user']['showSuggestions']
        users_df.loc[user_id, 'group'] = TREATMENT_LABEL if show_suggestion else CONTROL_LABEL
        
        if show_suggestion:
            suggestions_df = data_cleaning_utils.create_suggestions_df_for_user(events_df, tasks_df)
            tasks_df = metrics.compute_metrics_for_tasks(tasks_df, suggestions_df)
            suggestions_df['user_id'] = user_id
            suggestions_dfs.append(suggestions_df)
        
        events_df['user_id'] = user_id
        events_dfs.append(events_df)

        tasks_df['user_id'] = user_id
        tasks_dfs.append(tasks_df)

    events_df = pd.concat(events_dfs)
    tasks_df = pd.concat(tasks_dfs)
    tasks_df = tasks_df.join(users_df[['group', 'country']], on='user_id')
    suggestions_df = pd.concat(suggestions_dfs)

    return events_df, tasks_df, suggestions_df

def perform_normality_test(df, cols, filter_col, filter_vals):
    # Perform Shapiro-Wilk test for normality
    rows = []

    for col in cols:
        pvals = []
        for filter_val in filter_vals:
            data = df[df[filter_col] == filter_val][col]
            pvals.append(stats.shapiro(data)[1])
        rows.append([col, *pvals])

    col_names = ["shapiro_" + val for val in filter_vals]
    df_shapiro = pd.DataFrame(rows, columns=['col', *col_names])
    
    for col in col_names:
        df_shapiro[f"{col}_interpretation"] = df_shapiro[col].apply(lambda x: 'Normal' if x > 0.05 else 'Not normal')

    return df_shapiro
    
def perform_statistical_test(df, cols, filter_col, filter_vals, test_name):
    # Perform statistical test
    results = []
    
    data1 = df[df[filter_col] == filter_vals[0]]
    data2 = df[df[filter_col] == filter_vals[1]]

    for col in cols:
        if test_name == 'ttest':
            # Perform t-test
            stat, p_value = stats.ttest_ind(data1[col], data2[col])
            cohensd = cohens_d(data1[col], data2[col])
        elif test_name == 'mannwhitney':
            # Perform Mann-Whitney U test since the data is not normally distributed
            stat, p_value = stats.mannwhitneyu(data1[col], data2[col], alternative='two-sided')
            cliffsd = cliffs_d(data1[col], data2[col])

        result = {
            'col': col,
            't_stat' if test_name == 'ttest' else 'u_stat': stat,
            'p_value': p_value,
            'cohens_d' if test_name == 'ttest' else 'cliffs_d': cohensd if test_name == 'ttest' else cliffsd
        }
        if test_name == 'ttest':
            result['df'] = stats.ttest_ind(data1[col], data2[col]).df
        results.append(result)

    stats_results = pd.DataFrame(results)
    stats_results['significant'] = stats_results['p_value'] < 0.05

    stats_results = stats_results.style.set_caption(f"Comparing {filter_vals[0]} vs {filter_vals[1]}")

    return stats_results

def cohens_d(x,y):
    nx = len(x)
    ny = len(y)
    dof = nx + ny - 2
    return (mean(x) - mean(y)) / sqrt(((nx-1)*std(x, ddof=1) ** 2 + (ny-1)*std(y, ddof=1) ** 2) / dof)

def cliffs_d(x,y):
    test_result = stats.mannwhitneyu(x, y)
    return (2*test_result[0] / (len(x) * len(y))) - 1

def lookup_size(delta: float, metric: str) -> str:
    """
    Taken from: https://github.com/neilernst/cliffsDelta/blob/master/cliffs_delta/__init__.py
    
    :type delta: float
    """
    if metric == 'cohens':
        dull = {'small': 0.2, 'medium': 0.5, 'large': 0.8}
    elif metric == 'cliffs':
        dull = {'small': 0.147, 'medium': 0.33, 'large': 0.474}
    
    delta = abs(delta)
    if delta < dull['small']:
        return 'negligible'
    if dull['small'] <= delta < dull['medium']:
        return 'small'
    if dull['medium'] <= delta < dull['large']:
        return 'medium'
    if delta >= dull['large']:
        return 'large'

def find_ngrams(mystring, n, remove_stopwords=False):
    # Function to find all ngrams in a string
    # Download the punkt tokenizer model
    nltk.download('punkt', quiet=True)

    # find the words in the string
    words = word_tokenize(mystring)

    if remove_stopwords:
        stop_words = set(stopwords.words('english'))
        punctuation = set(string.punctuation)
        words = [word for word in words if word.lower() not in stop_words and word.lower() not in punctuation]

    ngrams = list(zip(*[words[i:] for i in range(n)]))
    ngrams = [' '.join(ngram) for ngram in ngrams]
    return ngrams

def final_data_prep():
    # Calls all the relevant functions to prepare the data for analysis
    users_df = data_cleaning_utils.load_qualtrics_csv('data/qualtrics.csv')
    users_df = data_cleaning_utils.clean_users_df(users_df, keep_only_prolific_for_india=True, keep_only_prolific_for_us=True, remove_born_outside=True, remove_pilot=True)
    users_df['group'] = None

    events_df, tasks_df, suggestions_df = construct_dfs_for_analysis(users_df, 'data/events', TREATMENT_LABEL, CONTROL_LABEL)
    
    # Clean up tasks_df to make it easier to work with for analysis
    dfp = tasks_df.drop(columns=['prompt', 'minWords', 'finalHtml']).reset_index()
    
    # Compute some simple metrics for each essay
    dfp['ttr'] = dfp['finalHtml_stripped'].apply(metrics.calculate_ttr)
    dfp['acceptance_rate'] = dfp['accepted'] / dfp['shown']

    # Compute the essay embedding for each essay
    dfp = structured.get_essay_embeddings_for_all_essays(dfp, 'data/embeddings/study-120.pkl')

    return users_df, events_df, dfp, suggestions_df
    
    