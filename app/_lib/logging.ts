import db from "../../firestore";
import { doc, addDoc, collection, writeBatch } from "firebase/firestore";
import { Event, EventName } from "./types";

export const logEvent = async (
  userId: string,
  eventName: EventName,
  eventDetails: any
) => {
  const collectionRef = collection(db, "users", userId, "events");
  const timestamp = new Date();
  const event: Event = {
    eventName,
    timestamp: timestamp.getTime(),
    timestampStr: timestamp.toString(),
    eventDetails
  }
  await addDoc(collectionRef, event);
};

export const logEvents = async (
  userId: string,
  events: Event[]
) => {
  const batch = writeBatch(db);

  events.forEach(event => {
    const collectionRef = collection(db, "users", userId, "events");
    const newEventRef = doc(collectionRef);
    batch.set(newEventRef, event);
  });

  await batch.commit();
};

export const createEvent = (eventName: EventName, eventDetails: any): Event => {
  // If eventDetails already has a timestamp, use that, otherwise create a new one
  const timestamp = eventDetails.timestamp ? new Date(eventDetails.timestamp) : new Date();
  return {
    eventName,
    timestamp: timestamp.getTime(),
    timestampStr: timestamp.toString(),
    eventDetails
  };
};