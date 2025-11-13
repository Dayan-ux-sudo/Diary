import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    priority: 'medium',
    category: ''
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, [selectedDate]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/tasks`, {
        params: { date: selectedDate }
      });
      setTasks(response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Update existing task
        await axios.put(`${API_BASE}/tasks/${editingId}`, {
          ...formData,
          date: new Date(formData.date).toISOString()
        });
      } else {
        // Create new task
        await axios.post(`${API_BASE}/tasks`, {
          ...formData,
          date: new Date(formData.date).toISOString()
        });
      }
      setFormData({
        title: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        priority: 'medium',
        category: ''
      });
      setEditingId(null);
      fetchTasks();
      fetchStats();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const editTask = (task) => {
    // Support both `id` and `_id` coming from backend
    const id = task._id || task.id;
    setEditingId(id);
    setFormData({
      title: task.title || '',
      description: task.description || '',
      date: task.date ? format(parseISO(task.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      priority: task.priority || 'medium',
      category: task.category || ''
    });
    // Scroll to form (optional)
    const formEl = document.querySelector('.task-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      title: '',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      priority: 'medium',
      category: ''
    });
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const toggleTaskCompletion = async (taskId, completed) => {
    try {
      await axios.put(`${API_BASE}/tasks/${taskId}`, {
        completed: !completed
      });
      fetchTasks();
      fetchStats();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await axios.delete(`${API_BASE}/tasks/${taskId}`);
        fetchTasks();
        fetchStats();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const formatTaskDate = (dateString) => {
    return format(parseISO(dateString), 'MMM dd, yyyy');
  };

  return (
    <div className="container">
      <div className="header">
        <h1>📝 Daily Diary</h1>
        <p>Monitor and manage your daily tasks effectively</p>
      </div>

      <div className="dashboard">
        <div className="stats-card">
          <h3>📊 Statistics</h3>
          <div className="stat-item">
            <span>Total Tasks:</span>
            <strong>{stats.totalTasks || 0}</strong>
          </div>
          <div className="stat-item">
            <span>Completed:</span>
            <strong>{stats.completedTasks || 0}</strong>
          </div>
          <div className="stat-item">
            <span>Today's Tasks:</span>
            <strong>{stats.todayTasks || 0}</strong>
          </div>
          <div className="stat-item">
            <span>Completion Rate:</span>
            <strong>{stats.completionRate || 0}%</strong>
          </div>
        </div>

        <div className="stats-card">
          <h3>💡 Tips</h3>
          <p>• Break large tasks into smaller steps</p>
          <p>• Prioritize tasks by importance</p>
          <p>• Review your progress daily</p>
          <p>• Celebrate completed tasks!</p>
        </div>
      </div>

      <div className="main-content">
        <div className="task-form">
          <h3>➕ Add New Task</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                placeholder="What needs to be done?"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Add details about your task..."
              />
            </div>

            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Priority</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                placeholder="Work, Personal, Health..."
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-block">
                {editingId ? 'Update Task' : 'Add Task'}
              </button>
              {editingId && (
                <button type="button" className="btn btn-block btn-secondary" onClick={cancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="tasks-section">
          <div className="date-selector">
            <h3>📅 Your Tasks</h3>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-input"
            />
          </div>

          {loading ? (
            <div className="loading">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="no-tasks">
              No tasks for {formatTaskDate(selectedDate)}. Add some tasks to get started!
            </div>
          ) : (
            <div className="task-list">
              {tasks.map((task) => (
                <div
                  key={task._id || task.id}
                  className={`task-item ${task.completed ? 'completed' : ''}`}
                >
                      <div className="task-header">
                    <div>
                      <div className="task-title">{task.title}</div>
                      {task.category && (
                        <small style={{ color: '#666' }}>#{task.category}</small>
                      )}
                    </div>
                    <span className={`task-priority priority-${task.priority}`}>
                      {task.priority}
                    </span>
                  </div>

                  {task.description && (
                    <div className="task-description">{task.description}</div>
                  )}

                  <div className="task-meta">
                    <span>{formatTaskDate(task.date)}</span>
                    <div className="task-actions">
                        <button
                          onClick={() => editTask(task)}
                          className="btn btn-sm btn-primary"
                        >
                          Edit
                        </button>
                      <button
                        onClick={() => toggleTaskCompletion(task._id || task.id, task.completed)}
                        className={`btn btn-sm ${task.completed ? 'btn-secondary' : 'btn-success'}`}
                      >
                        {task.completed ? 'Undo' : 'Complete'}
                      </button>
                      <button
                        onClick={() => deleteTask(task._id || task.id)}
                        className="btn btn-sm btn-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;