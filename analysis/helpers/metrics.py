import pylcs
import numpy as np
import pandas as pd

def get_longest_part_of_suggestion_in_final_essay(final_essay: str, suggestion: str) -> str:
    # Compute the longest common subsequence between the final essay and the suggestion.
    # This will help us compute how many of the suggestions are present in the final essay.
    # Taken from: https://github.com/kuangkzh/pylcs

    # Note: By using LCS, we are making an implicit assumption that modifying the suggestion
    # somewhere in the middle means a modification from there until the beginning or end
    # (whichever is closer). This is a simplification, but it should be good enough for our purposes.
    res = pylcs.lcs_string_idx(final_essay, suggestion)
    suggestion_in_final_essay = ''.join([suggestion[i] for i in res if i != -1])
    return suggestion_in_final_essay

def compute_ai_reliance_for_essay(final_essay: str, dfs: pd.DataFrame) -> float:
    """
    Compute the percentage of the final essay that is made up of suggestions.
    Computes the Longest Common Subsequence (LCS) between the final essay and each accepted suggestion.
    This ensures that even if the user has made changes to the suggestion, the AI reliance is still captured.

    Args:
        final_essay (str): The final essay text.
        dfs (pd.DataFrame): The DataFrame containing the suggestions for this essay.

    Returns:
        float: The percentage of the final essay that is made up of suggestions.
    """
    dfs = dfs[dfs['is_accepted'] == True]
    assert dfs['task_id'].nunique() <= 1

    total_chars = len(final_essay)
    suggestion_chars_in_final_essay = 0
    for idx, row in dfs.iterrows():
        suggestion = row['suggestionText']
        suggestion_in_final_essay = get_longest_part_of_suggestion_in_final_essay(final_essay, suggestion)
        suggestion_chars_in_final_essay += len(suggestion_in_final_essay)
        
        # Update final essay to remove the suggestion (to prevent double counting of suggestions -- corner case)
        final_essay = final_essay.replace(suggestion_in_final_essay, '')

    return suggestion_chars_in_final_essay / total_chars

def compute_suggestion_edit_rate(final_essay: str, dfs: pd.DataFrame) -> float:
    """
    Computes the suggestion edit rate for a given final essay and a DataFrame of suggestions.
    This metric quantifies the amount of editing the user has done to the suggestions.
    Higher values indicate that the user has made more changes to the suggestions.

    Parameters:
    final_essay (str): The final essay to compare the suggestions against.
    dfs (pd.DataFrame): The DataFrame containing the suggestions.

    Returns:
    float: The suggestion edit rate, which is the ratio of suggestion characters to suggestion characters in the final essay.
    """
    dfs = dfs[dfs['is_accepted'] == True]
    if dfs.empty: # if no suggestions were accepted, this metric is not defined
        return np.nan
    assert dfs['task_id'].nunique() == 1

    # Compute the length of the suggestion, and then the length of the suggestion characters in the final essay.
    # If they're the same, that means the user didn't edit the suggestion and vice versa.
    # For example, if the suggestion was "Hello there," but the user deleted "there," then edit rate would be 1 - (6/12) = 0.5,
    # as half of the suggestion was deleted. But if the user deleted only the comma, it would be 1 - (11/12) = 0.0833.
    total_suggestion_chars = 0
    suggestion_chars_in_final_essay = 0
    perc_suggestions_edited = []
    for idx, row in dfs.iterrows():
        suggestion = row['suggestionText']
        total_suggestion_chars += len(suggestion)
        
        suggestion_in_final_essay = get_longest_part_of_suggestion_in_final_essay(final_essay, suggestion)
        suggestion_chars_in_final_essay += len(suggestion_in_final_essay)

        perc_suggestion_edited = 1 - len(suggestion_in_final_essay) / len(suggestion)
        perc_suggestions_edited.append(perc_suggestion_edited)

        final_essay = final_essay.replace(suggestion_in_final_essay, '')
    
    # return 1 - (suggestion_chars_in_final_essay/total_suggestion_chars)
    return np.mean(perc_suggestions_edited)

def compute_percentage_edited_suggestions(final_essay: str, dfs: pd.DataFrame) -> float:
    """
    Of the suggestions accepted, how many were edited.

    Parameters:
    final_essay (str): The final essay to compare the suggestions against.
    dfs (pd.DataFrame): The DataFrame containing the suggestions.

    Returns:
    float: The percentage of suggestions in a task that were edited.
    """
    dfs = dfs[dfs['is_accepted'] == True]
    if dfs.empty: # if no suggestions were accepted, this metric is not defined
        return np.nan
    assert dfs['task_id'].nunique() == 1

    num_accepted = len(dfs)
    num_existing_as_is = 0
    for idx, row in dfs.iterrows():
        suggestion = row['suggestionText']
        
        if suggestion in final_essay:
            num_existing_as_is += 1
    
    return 1 - (num_existing_as_is/num_accepted)

def compute_metrics_for_tasks(tasks_df: pd.DataFrame, suggestions_df: pd.DataFrame):
    # Compute metrics for each task based on the suggestions seen in that task
    # AI reliance
    tasks_df['ai_reliance'] = tasks_df.apply(lambda x: compute_ai_reliance_for_essay(x['finalHtml_stripped'], suggestions_df[suggestions_df['task_id'] == x.name]), axis=1)

    # Suggestion edit rate
    tasks_df['suggestion_edit_rate'] = tasks_df.apply(lambda x: compute_suggestion_edit_rate(x['finalHtml_stripped'], suggestions_df[suggestions_df['task_id'] == x.name]), axis=1)

    # Percentage edited suggestions
    tasks_df['percentage_edited_suggestions'] = tasks_df.apply(lambda x: compute_percentage_edited_suggestions(x['finalHtml_stripped'], suggestions_df[suggestions_df['task_id'] == x.name]), axis=1)

    # Number of suggestions shown, accepted, and rejected
    suggestions_numbers = suggestions_df.groupby('task_id').agg(
        shown=('time_shown', 'count'),
        accepted=('is_accepted', 'sum'),
        ignored=('rejection_reason', lambda x: x.tolist().count('implicit')),
        rejected=('rejection_reason', lambda x: x.tolist().count('pressed_escape')))
    
    tasks_df = tasks_df.join(suggestions_numbers)

    return tasks_df

def calculate_ttr(text):
    import nltk
    from nltk.tokenize import word_tokenize

    # Download the punkt tokenizer model
    nltk.download('punkt', quiet=True)

    """Function to calculate TTR (Type-Token Ratio) for a given text."""
    # Tokenize the text
    tokens = word_tokenize(text.lower())
    
    # Get the set of unique tokens
    types = set(tokens)
    num_tokens = len(tokens)
    
    # Calculate the TTR
    ttr = len(types) / num_tokens if num_tokens > 0 else 0
        
    return ttr