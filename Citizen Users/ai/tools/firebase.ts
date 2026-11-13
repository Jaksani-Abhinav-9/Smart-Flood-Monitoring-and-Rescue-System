import admin from "firebase-admin";
import fs from "fs";
import { FIREBASE_CREDENTIALS_PATH } from "../core/config.js";

let _firestoreDb: any = null;

export function getFirestoreClient(): any {
  if (_firestoreDb) return _firestoreDb;

  try {
    if (FIREBASE_CREDENTIALS_PATH && fs.existsSync(FIREBASE_CREDENTIALS_PATH)) {
      const serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_CREDENTIALS_PATH, "utf-8"));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      admin.initializeApp();
    }
    _firestoreDb = admin.firestore();
    return _firestoreDb;
  } catch (e) {
    // Fail silently to prevent server crash; operations will fall back to mock data
    return null;
  }
}

export async function getActiveSos(): Promise<any[]> {
  const db = getFirestoreClient();
  if (!db) return getMockSos();
  try {
    const snapshot = await db.collection("sos").get();
    const sosList: any[] = [];
    snapshot.forEach((doc: any) => {
      sosList.push({ id: doc.id, source: "live", ...doc.data() });
    });
    return sosList;
  } catch (e) {
    console.warn(`[WARNING] Failed to fetch active SOS from Firestore, returning simulated data: ${e}`);
    return getMockSos();
  }
}

export async function getUserProfile(uid: string): Promise<any> {
  const db = getFirestoreClient();
  if (!db || !uid) return getMockUser(uid);
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (doc.exists) {
      return { uid: doc.id, source: "live", ...doc.data() };
    }
    return getMockUser(uid);
  } catch (e) {
    console.warn(`[WARNING] Failed to fetch user profile from Firestore, returning simulated profile: ${e}`);
    return getMockUser(uid);
  }
}

function getMockSos() {
  return [
    {
      id: "mock_sos_1",
      source: "simulated",
      name: "Rescue Team Alpha Test",
      location: "Kamareddy District HQ (Simulated)",
      lat: 18.3200,
      lng: 78.3000,
      status: "pending",
      priority: "high"
    },
    {
      id: "mock_sos_2",
      source: "simulated",
      name: "Secunderabad Guest User",
      location: "Secunderabad Metro Zone (Simulated)",
      lat: 17.4399,
      lng: 78.5009,
      status: "active",
      priority: "medium"
    }
  ];
}

function getMockUser(uid: string) {
  return {
    uid: uid || "mock_user_123",
    source: "simulated",
    name: "Mock Citizen Tester (Simulated)",
    email: "citizen@test.com",
    phone: "987-654-3210",
    role: "citizen",
    location: "Kamareddy"
  };
}
