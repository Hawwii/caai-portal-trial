import pandas as pd
from bs4 import BeautifulSoup
import helpers.constants as constants

def extract_text_from_html(html_str: str) -> str:
    """
    Removes HTML tags from the given HTML string and returns the cleaned text.

    Args:
        html_str (str): The HTML string to remove tags from.

    Returns:
        str: The cleaned text without HTML tags.
    """
    soup = BeautifulSoup(html_str, features="html.parser")
    text = soup.get_text(separator=' ')
    text = text.replace('\xa0', ' ')
    
    return text

def create_events_df(events: list[dict]):
    """
    Creates a pandas DataFrame from a list of event dictionaries.

    Args:
        events (list[dict]): A list of event dictionaries.

    Returns:
        pandas.DataFrame: A DataFrame containing the event data.
    """
    df = pd.DataFrame(events)
    del df['timestampStr']
    df = df.sort_values('timestamp')

    return df

def create_task_df_for_user(events_df: pd.DataFrame):
    """
    Create a task DataFrame for a user based on event data.

    Args:
        event_df (pd.DataFrame): The DataFrame containing event data.

    Returns:
        pd.DataFrame: The task DataFrame for the user.
    """
    df = events_df

    # Get the task details from the "task_started" events
    dft = df[df['eventName'] == 'task_started'].sort_values('timestamp').reset_index(drop=True)
    event_details_df = pd.json_normalize(dft['eventDetails'].apply(lambda x: x['task']))
    dft = pd.concat([dft.drop(columns=['eventDetails']), event_details_df], axis=1)
    # Drop duplicate task_started events (sometimes happens due to double-clicking; keep the event when the user *first* started the task)
    dft = dft.drop_duplicates(subset=dft.drop(columns=['timestamp']).columns, keep='first').reset_index(drop=True)
    dft = dft.drop(columns=['completed', 'eventName'])
    dft = dft.rename(columns={'timestamp': 'time_started'})
    dft = dft.set_index('id')

    # Get the final task details from the "task_completed" events and then join the two
    dftt = df[df['eventName'] == 'task_completed'].sort_values('timestamp').reset_index(drop=True).drop(columns=['eventName'])
    dftt = pd.concat([dftt.drop(columns=['eventDetails']), pd.json_normalize(dftt['eventDetails'])], axis=1)

    # Ensure that there is no other event happened between the duplicated clicks – crazy sanity check to confirm that this was indeed just a double click when the user was waiting
    duplicated_rows = dftt[dftt.duplicated(subset=dftt.drop(columns=['timestamp']).columns)].reset_index(drop=True)
    for i, row in duplicated_rows.iterrows():
        if row['taskId'] != duplicated_rows.loc[i+1, 'taskId']:
            continue
        timestamp1 = row['timestamp']
        timestamp2 = duplicated_rows.loc[i+1, 'timestamp']
        assert len(events_df[ (events_df['timestamp'] > timestamp1) & (events_df['timestamp'] < timestamp2)]) == 0
        if i == len(duplicated_rows) - 2:
            break
    # Drop the duplicates due to double-clicking
    dftt = dftt.drop_duplicates(subset=dftt.drop(columns=['timestamp']).columns, keep='first').reset_index(drop=True)
    dftt = dftt.rename(columns={'timestamp': 'time_completed'}).set_index('taskId')

    dft = dft.join(dftt)

    # Just some minor post-processing to calculate the task duration and the character length of the final HTML
    dft['finalHtml_stripped'] = dft['finalHtml'].apply(lambda x: extract_text_from_html(x))
    dft['duration_s'] = (dft['time_completed'] - dft['time_started'])/1000
    dft['charLength'] = dft['finalHtml_stripped'].apply(lambda x: len(x))
    
    return dft

def unravel_suggestion_details_from_json(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transforms the suggestions DataFrame to include the task details.

    Args:
        df (pd.DataFrame): The DataFrame containing the suggestions data.

    Returns:
        pd.DataFrame: The transformed DataFrame.
    """
    df = df.reset_index(drop=True)
    df = pd.concat([df.drop(columns=['eventDetails']), pd.json_normalize(df['eventDetails'])], axis=1)
    df = df.set_index('suggestionId')
    df['ts'] = df['timestamp'].apply(lambda x: x.iloc[0], axis=1) # keep only one timestamp column
    df = df.drop(columns=['timestamp', 'eventName'])

    return df

def create_suggestions_df_for_user(events_df: pd.DataFrame, tasks_df: pd.DataFrame):
    """
    Create a DataFrame containing suggestions shown, accepted, and rejected for a user.

    Args:
        event_df (pd.DataFrame): The input DataFrame containing event data.

    Returns:
        pd.DataFrame: The resulting DataFrame with suggestions shown, accepted, and rejected.
    """
    df = events_df

    # Suggestions shown
    df_shown = df[df['eventName'] == 'suggestion_shown']
    df_shown = unravel_suggestion_details_from_json(df_shown)
    df_shown = df_shown.rename(columns={'ts': 'time_shown'})

    # Suggestions accepted
    df_accepted = df[df['eventName'] == 'suggestion_accepted']
    if df_accepted.empty:
        df_accepted = pd.DataFrame()
    else:
        df_accepted = unravel_suggestion_details_from_json(df_accepted)
        df_accepted = df_accepted.rename(columns={'ts': 'time_acc/rej'})
        df_accepted['is_accepted'] = True

    # Suggestions rejected
    df_rejected = df[df['eventName'] == 'suggestion_rejected']
    df_rejected = unravel_suggestion_details_from_json(df_rejected)
    df_rejected = df_rejected.rename(columns={'ts': 'time_acc/rej', 'reason': 'rejection_reason'})
    df_rejected['is_accepted'] = False

    # Join the three DataFrames
    df_accepted_rejected = pd.concat([df_accepted, df_rejected])
    df_accepted_rejected['is_accepted'] = df_accepted_rejected['is_accepted'].astype('boolean').fillna(False)
    df_accepted_rejected['rejection_reason'] = df_accepted_rejected['rejection_reason'].fillna('')

    df_shown = df_shown.join(df_accepted_rejected)

    # For each suggestion, compute which task it was for
    df_shown['task_id'] = df_shown['time_shown'].apply(lambda x: find_task_id_for_suggestion(x, tasks_df))
    print(f"Removing erroneous suggestions: {len(df_shown[df_shown.isnull().any(axis=1)])}/{len(df_shown)}")
    df_shown = df_shown.dropna()

    return df_shown

def find_task_id_for_suggestion(suggestion_time, tasks_df):
    """
    Finds the task ID for a given suggestion based on the time the suggestion was shown and
    the task start and end times.

    Parameters:
    - suggestion_time (int): The time of the suggestion.
    - tasks_df (DataFrame): The DataFrame containing task information.

    Returns:
    - int or None: The task ID if found, None otherwise.
    """
    task = tasks_df[(tasks_df['time_started'] <= suggestion_time) & (tasks_df['time_completed'] >= suggestion_time)]
    if not task.empty:
        return task.index[0]
    return None

def load_qualtrics_csv(filepath: str) -> pd.DataFrame:
    users_df = pd.read_csv(filepath, index_col='completionCode', header=0)
    users_df = users_df[['StartDate', 'Duration (in seconds)'] + users_df.columns[users_df.columns.str.startswith('Q')].tolist()]
    users_df.columns = users_df.iloc[0]
    users_df = users_df[(users_df.index.str.startswith('u-')) | (users_df.index.str.startswith('p-'))]
    columns_names = {
        'Duration (in seconds)': 'qualtrics_duration',
        'What is your age?': 'age',
        'What is your gender?': 'gender',
        'List of Countries': 'birth',
        'In which country do you currently reside?': 'country',
        'How long have you lived in this country? (in years)': 'years_in_country',
        'In which city do you currently reside?': 'city',
        'What is the highest level of education you have completed?': 'education',
        'What is your occupation?': 'occupation',
        'What languages do you speak?': 'languages'
    }
    users_df = users_df.rename(columns=columns_names)

    # Rename the columns with the SSVS data. Also process the SSVS data to keep only numerical values (not strings).
    ssvs_columns = users_df.columns[users_df.columns.str.startswith('Please rate')].tolist()
    ssvs_columns_names = {col: 'ssvs_' + col.split('for you. - ')[1].split(' ')[1].split('\n')[0].lower() for col in ssvs_columns}
    users_df = users_df.rename(columns=ssvs_columns_names)
    for col in ssvs_columns_names.values():
        users_df[col] = users_df[col].astype(str).str.extract('(\d+)', expand=False).astype(float)

    users_df['country'] = users_df.apply(lambda x: x['birth'] if pd.isna(x['country']) else x['country'], axis=1)
    # rename index column
    users_df.index.name = 'user_id'
    users_df.columns.name = None

    # In the country column, replace any instance of "United States of America" with "United States"
    for col_name in ['birth', 'country']:
        users_df[col_name] = users_df[col_name].str.lower()
        users_df[col_name] = users_df[col_name].replace('united states of america', 'US')
        users_df[col_name] = users_df[col_name].replace('india', 'IND')

    # Filter participants who were not born in the same country as they currently reside in
    diff_birth_country = users_df[users_df['birth'] != users_df['country']]
    if len(diff_birth_country) > 0:
        print("Warning: Some participants were not born in the same country as they currently reside in.", diff_birth_country.index.tolist())
    
    users_df['Start Date'] = pd.to_datetime(users_df['Start Date'])

    # Some Prolific user refreshed the page and started the study again, which gave them a u- code instead of a p- code
    # Let's replace the u- code with their p- code (known through Prolific)
    users_df = users_df.rename(index=constants.u2p_mapping)
    
    return users_df

def clean_users_df(users_df, keep_only_prolific_for_india, keep_only_prolific_for_us, remove_born_outside, remove_pilot=False):
    """
    Cleans the users dataframe by removing bad users and filtering for Indian and US.

    Args:
        users_df (pandas.DataFrame): The dataframe containing user information.
        keep_only_prolific_for_india (bool): Flag indicating whether to include only prolific users from India.
        keep_only_prolific_for_us (bool): Flag indicating whether to include only prolific users from the US.
        remove_born_outside (bool): Flag indicating whether to remove users who were born outside the country they currently reside in.

    Returns:
        pandas.DataFrame: The cleaned users dataframe.
    """
    users_df = users_df[~users_df.index.isin(constants.bad_users)]

    if remove_born_outside:
        print("Removing users who were not born in the same country as they currently reside")
        users_df = users_df[users_df['birth'] == users_df['country']]

    if keep_only_prolific_for_india:
        indian_users = users_df[(users_df['country'] == 'IND') & (users_df.index.str.startswith('p-'))]
    else:
        indian_users = users_df[users_df['country'] == 'IND']
    
    if keep_only_prolific_for_us:
        us_users = users_df[(users_df['country'] == 'US') & (users_df.index.str.startswith('p-'))]
    else:
        us_users = users_df[users_df['country'] == 'US']

    users_df = pd.concat([indian_users, us_users])

    if remove_pilot:
        users_df = users_df[users_df['Start Date'] > '2024-07-31']
    
    if len(users_df[users_df.index.duplicated(keep='first')]) > 0:
        print("Warning: Some users have duplicate entries. Removing such users.")
        users_df = users_df[~users_df.index.duplicated(keep=False)] # don't keep any duplicates

    return users_df