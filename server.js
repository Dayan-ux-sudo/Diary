import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Firebase Admin (robust)
function initFirebaseAdmin() {
  // Prefer Application Default Credentials if available
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    console.log('Firebase Admin initialized using application default credentials');
    return;
  }

  // If a service account JSON string is provided via env var, parse it
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    let svc;
    try {
      svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not valid JSON');
    }

    if (!svc.project_id || typeof svc.project_id !== 'string') {
      throw new Error('Service account JSON (FIREBASE_SERVICE_ACCOUNT) must contain a string "project_id" property');
    }

    if (svc.private_key && typeof svc.private_key === 'string') {
      svc.private_key = svc.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(svc)
    });
    console.log('Firebase Admin initialized using FIREBASE_SERVICE_ACCOUNT');
    return;
  }

  // Fallback: build service account from individual env vars
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const svc = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
      universe_domain: 'googleapis.com'
    };

    admin.initializeApp({
      credential: admin.credential.cert(svc)
    });
    console.log('Firebase Admin initialized using individual FIREBASE_* env vars');
    return;
  }

  // Nothing found - throw a clear error so developer can fix env
  throw new Error(
    'Missing Firebase credentials. Set GOOGLE_APPLICATION_CREDENTIALS, or provide FIREBASE_SERVICE_ACCOUNT (JSON), or provide FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.'
  );
}

try {
  initFirebaseAdmin();
} catch (error) {
  console.error('Firebase Admin initialization error:', error.message || error);
  // Exit early because the API requires Firestore. This prevents later cryptic crashes.
  process.exit(1);
}

const db = admin.firestore();

// Middleware
app.use(cors());
app.use(express.json());

// Utility function to convert Firestore timestamp to ISO string
const convertTimestamps = (doc) => {
  const data = doc.data();
  const converted = {};
  
  Object.keys(data).forEach(key => {
    if (data[key] && typeof data[key] === 'object' && 'toDate' in data[key]) {
      converted[key] = data[key].toDate().toISOString();
    } else {
      converted[key] = data[key];
    }
  });
  
  return {
    id: doc.id,
    ...converted
  };
};

// Routes

// Get all tasks
// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    // Temporarily skip date filtering for demo (to avoid index requirement)
    let tasksRef = db.collection('tasks').orderBy('createdAt', 'desc');
    
    // If you want to filter by date later, you'll need a composite index (see Option B).
    // For now, frontend will handle client-side filtering.
    
    const snapshot = await tasksRef.get();
    
    if (snapshot.empty) {
      return res.json([]);
    }
    
    const tasks = snapshot.docs.map(convertTimestamps);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: error.message });
  }
});


// Create new task
app.post('/api/tasks', async (req, res) => {
  try {
    const taskData = {
      ...req.body,
      date: new Date(req.body.date),
      createdAt: new Date(),
      completed: req.body.completed || false
    };
    
    const docRef = await db.collection('tasks').add(taskData);
    const newTask = await docRef.get();
    
    res.status(201).json(convertTimestamps(newTask));
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    const updateData = { ...req.body };
    
    // Convert date string back to Date object if provided
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }
    
    await taskRef.update(updateData);
    
    // Return updated task
    const updatedTask = await taskRef.get();
    res.json(convertTimestamps(updatedTask));
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    await taskRef.delete();
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get tasks statistics
app.get('/api/stats', async (req, res) => {
  try {
    const tasksSnapshot = await db.collection('tasks').get();
    const tasks = tasksSnapshot.docs.map(convertTimestamps);
    
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.completed).length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayTasks = tasks.filter(task => {
      const taskDate = new Date(task.date);
      return taskDate >= today && taskDate < tomorrow;
    }).length;
    
    res.json({
      totalTasks,
      completedTasks,
      todayTasks,
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Diary API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Firebase Project: ${process.env.FIREBASE_PROJECT_ID}`);
});
 