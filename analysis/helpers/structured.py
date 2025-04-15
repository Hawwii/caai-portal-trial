from langchain_openai import AzureChatOpenAI
from openai import AzureOpenAI
from langchain_core.pydantic_v1 import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
import pandas as pd
from tqdm import tqdm
import pickle
from dotenv import load_dotenv
import json
import os

def extract_structured_data_from_tasks(task_id: str, df_tasks: pd.DataFrame, model: AzureChatOpenAI, DIR = "data/structured_data", quiet=False) -> dict:
    
    class Movie(BaseModel):
        name: str = Field(description="Name of the movie (corrected for spelling, if necessary)")
        country: str = Field(description="The country where the movie was released, e.g., US, India, UK, etc.")
    
    class PublicFigure(BaseModel):
        name: str = Field(description="Name of the public figure (corrected for spelling, if necessary)")
        country: str = Field(description="The country wheere the public figure is from, e.g., US, India, UK, etc.")
        profession: str = Field(description="The profession of the public figure, e.g., actor, politician, singer, etc.")
    
    class Food(BaseModel):
        name: str = Field(description="Name of the food item (corrected for spelling, if necessary)")
        country: str = Field(description="The country where the food item is from, e.g., US, India, UK, etc.")
    
    class Festival(BaseModel):
        name: str = Field(description="Name of the festival (corrected for spelling, if necessary)")
        country: str = Field(description="The country where the festival is most commonly celebrated, e.g., US, India, UK, etc.")
    
    task_structure_mapping = {
        "movie": Movie,
        "public_figure": PublicFigure,
        "food": Food,
        "festival": Festival
    }

    tagging_prompt = ChatPromptTemplate.from_template(
    """
    Extract the desired information from the following passage. Only extract the properties mentioned in the provided function.

    Passage:
    {input}
    """
    )

    tagging_chain = tagging_prompt | model.with_structured_output(task_structure_mapping[task_id])
    
    structured_data_for_task = {}
    
    iterator = df_tasks.iterrows() if quiet else tqdm(df_tasks.iterrows())
    for index, row in iterator:
        user_id = row['user_id']
        filename = f"{DIR}/{user_id}_{task_id}.json"

        # If filename already exists, don't fetch again
        if os.path.exists(filename):
            with open(filename, "r") as f:
                structured_data_for_task[user_id] = json.load(f)
            continue
        
        essay = row['finalHtml_stripped']
        res = tagging_chain.invoke({"input": essay})
        res_dict = res.dict()
        
        structured_data_for_task[user_id] = res_dict

        # Store as json file
        with open(filename, "w") as f:
            json.dump(res_dict, f)
    
    df_structured = pd.DataFrame(structured_data_for_task).T
    df_structured = df_structured.rename(columns={"country": "artifact_country"})

    # Some corrections to the structured data (e.g., Christmas is in US)
    df_structured[f'artifact_country'] = df_structured.apply(lambda x: 'US' if x['name'] == 'Christmas' else x['artifact_country'], axis=1)

    # Bin into India and Other
    df_structured[f'artifact_country_binned'] = df_structured['artifact_country'].apply(lambda x: x if x == 'India' else 'Other')
        
    return df_structured

def get_openai_embedding_for_string(text):
    # Create client
    load_dotenv()
    client = AzureOpenAI(
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),  
        api_version="2024-02-01",
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
    )

    # Get embeddings
    response = client.embeddings.create(
        input = text,
        model= "embedding-for-culture"
    )

    return response.data[0].embedding

def get_essay_embeddings_for_all_essays(df_tasks, outfile):
    # Get embeddings for each essay

    if os.path.exists(outfile):
        embeddings = pickle.load(open(outfile, "rb"))
    else:
        embeddings = []
        for i, row in tqdm(df_tasks.iterrows()):
            embedding = get_openai_embedding_for_string(row['finalHtml_stripped'])
            embeddings.append((row['user_id'], row['id'], embedding))
            
        pickle.dump(embeddings, open(outfile, "wb"))

    df_embeddings = pd.DataFrame(embeddings, columns=['user_id', 'id', 'embedding'])
    df_tasks = df_tasks.join(df_embeddings.set_index(['user_id', 'id']), on=['user_id', 'id'])
    
    return df_tasks

def get_celebrity_info(client, final_essay, suggestions_shown):
    """
    Extracts the favorite celebrity mentioned in the user's final essay and the first celebrity suggested by the system.

    Args:
        final_essay (str): The final essay submitted by the user.
        suggestions_shown (list): A list of suggestions that were offered to the user by the system.

    Returns:
        str: A JSON string containing the favorite celebrity mentioned in the final essay and the first celebrity suggested by the system.
        The JSON string has the following format:
            "favorite_celebrity": "<name>",
            "first_suggested": "<name>"
    """
    messages = [
        {
            "role": "system",
            "content": "I have logs from a system that offers autocomplete suggestions to users when they're typing. I will give you the final essay submitted by the user, and a Python list of all the suggestions that were offered to them. I want you to tell me two things:\n1. Which celebrity did the user say was their favorite in their final essay?\n2. What celebrity was the first one suggested to them by the system? This is a bit tricky. For example, if the list of suggestions offered is: [' My favorite celebrity is', 'eyoncé because she is incredibly talented and inspiring.', 'y Eilish because of her unique style.', ' Eilish because of her unique style.', ' actor Shah Rukh Khan because', ...] you can kinds make out that the first suggestion was probably Beyoncé.\n\nOutput ONLY a JSON string:\n{\"favorite_celebrity\": \"<name>\", \"first_suggested\": \"<name>\"}"
        },
        {
            "role": "user",
            "content": f"<final_essay>\n{final_essay}\n</final_essay>\n\n<suggestions_shown>\n{json.dumps(suggestions_shown)}\n</suggestions_shown>"
        }
    ]
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        response_format={
            "type": "json_object"
        },
        temperature=1,
        max_tokens=2048,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0
    )
    return response.choices[0].message.content