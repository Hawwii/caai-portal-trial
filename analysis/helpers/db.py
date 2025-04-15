import os
import json
from progressbar import progressbar
from google.cloud import firestore
import helpers.constants

def hi():
    print("what")

def init_firestore_client(emulator=False) -> firestore.Client:
    """
    Initializes a Firestore client instance.

    Args:
        emulator (bool, optional): Whether to connect to the Firestore emulator. Defaults to False.

    Returns:
        firestore.Client: The Firestore client instance.
    """
    
    if emulator:
        os.environ["FIRESTORE_EMULATOR_HOST"] = "localhost:8080"
        os.environ["GCLOUD_PROJECT"] = "caai-portal"
    else:
        # Set Google Application Credentials
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "./ServiceAccountKey.json"

    db = firestore.Client()
    return db

def get_all_document_ids_in_collection(db: firestore.Client, collection: str):
    """
    Retrieves all document IDs from a given collection in a database. Usage:
    `user_ids = dbutils.get_all_document_ids_in_collection(db, 'users')`

    Args:
        db (firestore.Client): The database object.
        collection (str): The name of the collection.

    Returns:
        list: A list of document IDs.
    """
    docs = db.collection(collection).list_documents()
    doc_ids = [doc.id for doc in docs]

    return doc_ids

def get_events_for_userid(db: firestore.Client, userid: str):
    """
    Retrieves a list of events for a given user ID from the Firestore database.

    Args:
        db (firestore.Client): The Firestore client instance.
        userid (str): The user ID for which to retrieve the events.

    Returns:
        list: A list of event documents as dictionaries.
    """
    coll = db.collection(f'users/{userid}/events')
    docs = coll.list_documents()
    docs = [doc.get().to_dict() for doc in docs]

    return docs

def download_events_data_for_user(user_id: str, db: firestore.Client, dir: str):

    # If data/events/{user_id}.json doesn't exist, create it
    if not os.path.exists(f'{dir}/{user_id}.json'):

        # Some Prolific user refreshed the page and started the study again, which gave them a u- code instead of a p- code.
        # To keep things consistent, we mapped them to their prolific ID.
        # But the db only knows their original u-code. Here, we map their p-code to their u-code so we can download their data.
        p2u_mapping = {v: k for k, v in constants.u2p_mapping.items()}
        if user_id in p2u_mapping:
            user_id = p2u_mapping[user_id]

        events = get_events_for_userid(db, user_id)

        # Return the user id back to their Prolific one
        if user_id in constants.u2p_mapping:
            user_id = constants.u2p_mapping[user_id]
        
        with open(f'{dir}/{user_id}.json', 'w') as f:
            json.dump(events, f)

def load_events_for_user(user_id: str, dir: str):
    with open(f'{dir}/{user_id}.json', 'r') as f:
        events = json.load(f)
    return events
    