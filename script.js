/// Firebase Configuration
const firebaseConfig = {

  apiKey: "AIzaSyCrjTmqrDZ8whi5CTLoqe3qZee7RADsgOY",

  authDomain: "landscape-management-202-700cb.firebaseapp.com",

  databaseURL: "https://landscape-management-202-700cb-default-rtdb.firebaseio.com",

  projectId: "landscape-management-202-700cb",

  storageBucket: "landscape-management-202-700cb.firebasestorage.app",

  messagingSenderId: "911348979770",

  appId: "1:911348979770:web:b156f940ef398c621afd03",
};
// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize services - USING COMPAT VERSION
const database = firebase.database(); // Real-Time Database
const auth = firebase.auth(); // Authentication

// Create db reference for compatibility
const db = firebase.database(); // Add this line

// Global variables
let currentUser = null;
let tasks = {};
let isAdmin = false;
let currentUserEmail = "";

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing app...");
    initializeApp();
});

async function initializeApp() {
    try {
        // Listen for task updates
        setupRealtimeListeners();
        
        // Check if user is already logged in from localStorage
        const savedUser = localStorage.getItem('greenfield_user');
        if (savedUser) {
            const userData = JSON.parse(savedUser);
            currentUser = userData.name;
            currentUserEmail = userData.email || "";
            isAdmin = userData.isAdmin || false;
            console.log("User loaded from localStorage:", currentUser, currentUserEmail, isAdmin);
        }
    } catch (error) {
        console.error("Initialization error:", error);
    }
}

// Setup realtime database listeners
function setupRealtimeListeners() {
    db.ref('tasks').on('value', (snapshot) => {
        tasks = snapshot.val() || {};
        console.log("Tasks updated from Firebase. Total tasks:", Object.keys(tasks).length);
        
        // Call render functions based on current page
        if (window.location.pathname.includes('team.html') && !isAdmin) {
            if (typeof renderTeamTasks === 'function') {
                renderTeamTasks();
            }
        } else if (window.location.pathname.includes('admin.html') && isAdmin) {
            if (typeof filterTasks === 'function') {
                filterTasks();
                updateStats();
            }
            if (typeof renderApprovalTasks === 'function') {
                renderApprovalTasks();
            }
        } else {
            renderTasks();
            updateTaskCount();
            updateStats();
        }
    });
}

// ========== APPROVAL FUNCTIONS ==========

// Approve a task (Admin only)
async function approveTask(taskId) {
    if (!isAdmin) {
        showNotification("Only admins can approve tasks", "error");
        return false;
    }
    
    try {
        const taskRef = db.ref(`tasks/${taskId}`);
        const snapshot = await taskRef.once('value');
        const task = snapshot.val();
        
        if (!task) {
            showNotification("Task not found", "error");
            return false;
        }
        
        if (task.status === 'approved') {
            showNotification("Task is already approved", "info");
            return false;
        }
        
        // Update task to approved status
        const updates = {
            status: 'approved',
            approved_by: currentUserEmail || currentUser,
            approved_at: new Date().toISOString(),
            approved_date: new Date().toISOString(),
            is_visible_to_all: true,
            needs_approval: false,
            last_updated: Date.now()
        };
        
        await taskRef.update(updates);
        
        showNotification("Task approved successfully!", "success");
        return true;
    } catch (error) {
        console.error("Error approving task:", error);
        showNotification("Failed to approve task: " + error.message, "error");
        return false;
    }
}

// Reject a task (Admin only)
async function rejectTask(taskId, reason = '') {
    if (!isAdmin) {
        showNotification("Only admins can reject tasks", "error");
        return false;
    }
    
    if (!reason) {
        reason = prompt("Please provide a reason for rejection:", "Not approved");
        if (reason === null) return false;
    }
    
    try {
        const taskRef = db.ref(`tasks/${taskId}`);
        const snapshot = await taskRef.once('value');
        const task = snapshot.val();
        
        if (!task) {
            showNotification("Task not found", "error");
            return false;
        }
        
        // Update task to rejected status
        const updates = {
            status: 'rejected',
            rejected_by: currentUserEmail || currentUser,
            rejected_at: new Date().toISOString(),
            rejection_reason: reason,
            is_visible_to_all: false,
            last_updated: Date.now()
        };
        
        await taskRef.update(updates);
        
        showNotification("Task rejected", "success");
        return true;
    } catch (error) {
        console.error("Error rejecting task:", error);
        showNotification("Failed to reject task: " + error.message, "error");
        return false;
    }
}

// ========== TASK FUNCTIONS ==========

// Add new task - SIMPLIFIED VERSION
async function addTask(description, zone, photoFile = null) {
    console.log("addTask called with:", { description, zone, photoFile });
    
    try {
        // Check if user is logged in
        if (!currentUser) {
            showNotification("Please login first", "error");
            return false;
        }
        
        // Validate inputs
        if (!description || !zone) {
            showNotification("Please fill all required fields", "error");
            return false;
        }
        
        // Generate a unique task ID
        const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        let photoBase64 = null;
        
        // Handle photo if provided
        if (photoFile && photoFile.size > 0) {
            try {
                // Check file size
                if (photoFile.size > 2 * 1024 * 1024) {
                    showNotification("Image must be less than 2MB", "error");
                    return false;
                }
                photoBase64 = await convertImageToBase64(photoFile);
            } catch (error) {
                console.warn("Could not process image:", error);
                // Continue without photo
            }
        }
        
        // Get user info
        const savedUser = JSON.parse(localStorage.getItem('greenfield_user') || '{}');
        
        // Create task data
        const taskData = {
            id: taskId,
            description: description.trim(),
            zone: zone,
            requested_by: currentUserEmail || currentUser,
            requested_by_name: currentUser,
            requested_at: new Date().toISOString(),
            status: 'pending',
            needs_approval: true,
            photoBase64: photoBase64,
            last_updated: Date.now(),
            department: savedUser.department || 'Not specified',
            user_zone: savedUser.zone || 'Not specified',
            is_visible_to_all: false,
            visible_to_creator: true,
            visible_to_admins: true,
            approved_by: null,
            approved_at: null,
            approved_date: null
        };
        
        console.log("Task data to save:", taskData);
        
        // Save to Firebase
        await db.ref(`tasks/${taskId}`).set(taskData);
        console.log("Task saved to Firebase successfully!");
        
        showNotification("Task submitted for approval!", "success");
        return true;
    } catch (error) {
        console.error("Error adding task:", error);
        showNotification("Failed to add task: " + error.message, "error");
        return false;
    }
}

// Convert image to Base64
function convertImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 600;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Update task status - FIXED to allow admins to mark tasks as completed
async function updateTaskStatus(taskId, status) {
    try {
        if (!currentUser) {
            showNotification("Please login first", "error");
            return false;
        }
        
        const taskRef = db.ref(`tasks/${taskId}`);
        const snapshot = await taskRef.once('value');
        const task = snapshot.val();
        
        if (!task) {
            showNotification("Task not found", "error");
            return false;
        }
        
        // Check permissions
        if (status === 'approved' && !isAdmin) {
            showNotification("Only admins can approve tasks", "error");
            return false;
        }
        
        // FIXED: Allow admins to mark any task as completed, team members can mark their own tasks
        if (status === 'completed') {
            if (!isAdmin) {
                // Team members can only complete tasks they created or are assigned to
                const canComplete = task.requested_by === currentUserEmail || 
                                  task.assigned_to === currentUserEmail ||
                                  task.assigned_to === currentUser;
                
                if (!canComplete) {
                    showNotification("You can only complete tasks created by you or assigned to you", "error");
                    return false;
                }
            }
            // Admins can mark any task as completed - no restriction
        }
        
        if (status === 'cancelled' && task.requested_by !== currentUserEmail && !isAdmin) {
            showNotification("You can only cancel tasks created by you", "error");
            return false;
        }
        
        if (status === 'rejected' && !isAdmin) {
            showNotification("Only admins can reject tasks", "error");
            return false;
        }
        
        const updates = {
            status: status.toLowerCase(),
            last_updated: Date.now()
        };
        
        const now = new Date().toISOString();
        
        switch(status.toLowerCase()) {
            case 'approved':
                updates.approved_by = currentUserEmail || currentUser;
                updates.approved_at = now;
                updates.is_visible_to_all = true;
                updates.needs_approval = false;
                break;
            case 'completed':
                updates.completed_by = currentUserEmail || currentUser;
                updates.completed_at = now;
                break;
            case 'cancelled':
                updates.cancelled_by = currentUserEmail || currentUser;
                updates.cancelled_at = now;
                break;
            case 'rejected':
                updates.rejected_by = currentUserEmail || currentUser;
                updates.rejected_at = now;
                updates.rejection_reason = "Rejected by admin";
                break;
        }
        
        await taskRef.update(updates);
        showNotification(`Task marked as ${status}`, "success");
        return true;
    } catch (error) {
        console.error("Error updating task:", error);
        showNotification(error.message, "error");
        return false;
    }
}

// ========== UTILITY FUNCTIONS ==========

// Show notification
function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        background: ${type === 'error' ? '#c62828' : type === 'success' ? '#2e7d32' : '#1565c0'};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
    `;
    
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 
                          type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 3000);
}

// ========== MISSING FUNCTIONS ==========

// Render tasks on index.html - FIXED to show "Mark Complete" for both admin and team
function renderTasks(searchTerm = '', statusFilter = '') {
    if (typeof document.getElementById('taskList') === 'undefined') return;
    
    const taskList = document.getElementById('taskList');
    if (!taskList) return;
    
    // Filter tasks
    let filteredTasks = Object.entries(tasks);
    
    if (searchTerm) {
        filteredTasks = filteredTasks.filter(([taskId, task]) => {
            const searchLower = searchTerm.toLowerCase();
            return (
                (task.description && task.description.toLowerCase().includes(searchLower)) ||
                (task.zone && task.zone.toLowerCase().includes(searchLower)) ||
                (task.requested_by && task.requested_by.toLowerCase().includes(searchLower))
            );
        });
    }
    
    if (statusFilter) {
        filteredTasks = filteredTasks.filter(([taskId, task]) => {
            return task.status === statusFilter;
        });
    }
    
    // Sort by date (newest first)
    filteredTasks.sort((a, b) => new Date(b[1].requested_at) - new Date(a[1].requested_at));
    
    if (filteredTasks.length === 0) {
        taskList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-clipboard-list" style="font-size: 3rem; margin-bottom: 15px;"></i>
                <h4>No tasks found</h4>
                <p>${searchTerm ? 'Try a different search term' : 'Create your first task!'}</p>
            </div>
        `;
        return;
    }
    
    let html = '<div style="display: grid; gap: 15px;">';
    
    filteredTasks.forEach(([taskId, task]) => {
        const status = task.status || 'pending';
        const isUrgent = task.is_urgent;
        const isAdminRequest = task.is_admin_request;
        const isAssigned = task.is_assigned;
        
        // Format date
        const taskDate = task.requested_at ? 
            new Date(task.requested_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Date not set';
        
        const approvedDate = task.approved_at ? 
            new Date(task.approved_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            }) : null;
        
        const completedDate = task.completed_at ? 
            new Date(task.completed_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            }) : null;
        
        let cardClass = 'task-card';
        if (isUrgent) cardClass += ' urgent';
        if (isAdminRequest) cardClass += ' admin-request';
        if (isAssigned) cardClass += ' assigned';
        
        // Check if current user can mark this task as completed
        const canComplete = isAdmin || 
                          task.requested_by === currentUserEmail || 
                          task.assigned_to === currentUserEmail ||
                          task.assigned_to === currentUser;
        
        html += `
            <div class="${cardClass}" id="task-${taskId}">
                <div class="task-meta">
                    <div>
                        <span class="status-badge status-${status.charAt(0).toUpperCase() + status.slice(1)}">
                            <i class="fas fa-${getStatusIcon(status)}"></i> ${status.toUpperCase()}
                        </span>
                        ${isUrgent ? '<span class="priority-badge priority-urgent"><i class="fas fa-exclamation-triangle"></i> URGENT</span>' : ''}
                        ${task.needs_approval && status === 'pending' ? '<span class="approval-badge"><i class="fas fa-clock"></i> NEEDS APPROVAL</span>' : ''}
                        <strong>${task.zone || 'No Zone'}</strong>
                    </div>
                    <small>${taskDate}</small>
                </div>
                
                ${task.title ? `<h4 style="color: #1b5e20; margin-bottom: 10px;">${task.title}</h4>` : ''}
                
                <p style="margin: 10px 0;">${task.description || 'No description'}</p>
                
                <div style="margin: 10px 0; font-size: 14px; color: #666;">
                    <div><i class="fas fa-user"></i> <strong>Requested by:</strong> ${task.requested_by_name || task.requested_by || 'Unknown'}</div>
                    ${task.assigned_to ? `<div><i class="fas fa-user-check"></i> <strong>Assigned to:</strong> ${task.assigned_to}</div>` : ''}
                    ${approvedDate ? `<div><i class="fas fa-check-circle"></i> <strong>Approved on:</strong> ${approvedDate} by ${task.approved_by || 'Admin'}</div>` : ''}
                    ${completedDate ? `<div><i class="fas fa-flag-checkered"></i> <strong>Completed on:</strong> ${completedDate}</div>` : ''}
                    ${task.rejection_reason ? `<div><i class="fas fa-times-circle"></i> <strong>Rejection reason:</strong> ${task.rejection_reason}</div>` : ''}
                </div>
                
                ${task.photoBase64 ? `
                    <div style="margin: 10px 0;">
                        <img src="${task.photoBase64}" alt="Task photo" 
                             style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd; cursor: pointer;"
                             onclick="openPhotoModal('${task.photoBase64}')">
                    </div>
                ` : ''}
                
                <div class="task-actions">
                    ${status === 'pending' && task.needs_approval && isAdmin ? `
                        <button class="btn submit" onclick="approveTask('${taskId}')">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="btn red" onclick="rejectTaskWithReason('${taskId}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : ''}
                    
                    ${status === 'approved' && canComplete ? `
                        <button class="btn submit" onclick="updateTaskStatus('${taskId}', 'completed')">
                            <i class="fas fa-check-circle"></i> Mark Complete
                        </button>
                    ` : ''}
                    
                    ${status === 'pending' && task.requested_by === currentUserEmail ? `
                        <button class="btn red" onclick="updateTaskStatus('${taskId}', 'cancelled')">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    ` : ''}
                    
                    ${isAdmin ? `
                        <button class="btn small" onclick="editTask('${taskId}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn small red" onclick="deleteTask('${taskId}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    taskList.innerHTML = html;
    
    // Update task count
    if (document.getElementById('taskCount')) {
        document.getElementById('taskCount').textContent = filteredTasks.length;
    }
}

// Get status icon
function getStatusIcon(status) {
    switch(status) {
        case 'pending': return 'clock';
        case 'approved': return 'check-circle';
        case 'completed': return 'flag-checkered';
        case 'cancelled': return 'times-circle';
        case 'rejected': return 'times-circle';
        default: return 'question-circle';
    }
}

// Update task count
function updateTaskCount() {
    if (document.getElementById('taskCount')) {
        const totalTasks = Object.keys(tasks).length;
        document.getElementById('taskCount').textContent = totalTasks;
    }
}

// Update statistics
function updateStats() {
    if (!tasks) return;
    
    const taskArray = Object.values(tasks);
    const totalTasks = taskArray.length;
    const pendingTasks = taskArray.filter(t => t.status === 'pending').length;
    const approvedTasks = taskArray.filter(t => t.status === 'approved').length;
    const completedTasks = taskArray.filter(t => t.status === 'completed').length;
    const needsApprovalTasks = taskArray.filter(t => t.needs_approval && t.status === 'pending').length;
    
    // Update quick stats
    if (document.getElementById('totalTasks')) {
        document.getElementById('totalTasks').textContent = totalTasks;
    }
    if (document.getElementById('pendingTasks')) {
        document.getElementById('pendingTasks').textContent = pendingTasks;
    }
    if (document.getElementById('approvedTasks')) {
        document.getElementById('approvedTasks').textContent = approvedTasks;
    }
    if (document.getElementById('completedTasks')) {
        document.getElementById('completedTasks').textContent = completedTasks;
    }
    if (document.getElementById('needsApprovalTasks')) {
        document.getElementById('needsApprovalTasks').textContent = needsApprovalTasks;
    }
}

// Export to Excel
function exportToExcel() {
    if (!isAdmin) {
        showNotification("Only admins can export data", "error");
        return;
    }
    
    try {
        // Convert tasks to array
        const tasksArray = Object.values(tasks).map(task => ({
            'Task ID': task.id,
            'Description': task.description,
            'Zone': task.zone,
            'Status': task.status,
            'Requested By': task.requested_by_name || task.requested_by,
            'Requested Date': task.requested_at ? new Date(task.requested_at).toLocaleString() : '',
            'Approved By': task.approved_by || '',
            'Approved Date': task.approved_at ? new Date(task.approved_at).toLocaleString() : '',
            'Completed Date': task.completed_at ? new Date(task.completed_at).toLocaleString() : '',
            'Priority': task.priority || 'normal',
            'Is Urgent': task.is_urgent ? 'Yes' : 'No',
            'Needs Approval': task.needs_approval ? 'Yes' : 'No',
            'Department': task.department || '',
            'Assigned To': task.assigned_to || ''
        }));
        
        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(tasksArray);
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tasks");
        
        // Generate filename
        const date = new Date().toISOString().split('T')[0];
        const filename = `Greenfield_Tasks_${date}.xlsx`;
        
        // Download
        XLSX.writeFile(wb, filename);
        
        showNotification("Exported to Excel successfully!", "success");
    } catch (error) {
        console.error("Export error:", error);
        showNotification("Failed to export: " + error.message, "error");
    }
}

// Show loading state
function showLoading(show) {
    const loadingElement = document.createElement('div');
    loadingElement.id = 'globalLoading';
    loadingElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255,255,255,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        font-size: 1.5rem;
        color: #1b5e20;
    `;
    loadingElement.innerHTML = `
        <div style="text-align: center;">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading...</p>
        </div>
    `;
    
    if (show) {
        document.body.appendChild(loadingElement);
    } else {
        const existing = document.getElementById('globalLoading');
        if (existing) {
            existing.remove();
        }
    }
}

// Open photo modal
function openPhotoModal(photoBase64) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="position: relative; max-width: 90%; max-height: 90%;">
            <img src="${photoBase64}" alt="Full size" style="max-width: 100%; max-height: 90vh; border-radius: 10px;">
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="position: absolute; top: -40px; right: 0; background: none; border: none; color: white; 
                           font-size: 30px; cursor: pointer;">×</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on click outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Edit task (admin only)
async function editTask(taskId) {
    if (!isAdmin) {
        showNotification("Only admins can edit tasks", "error");
        return;
    }
    
    const task = tasks[taskId];
    if (!task) {
        showNotification("Task not found", "error");
        return;
    }
    
    const newDescription = prompt("Edit task description:", task.description);
    if (newDescription === null) return;
    
    const newZone = prompt("Edit zone:", task.zone);
    if (newZone === null) return;
    
    try {
        await db.ref(`tasks/${taskId}`).update({
            description: newDescription,
            zone: newZone,
            last_updated: Date.now()
        });
        
        showNotification("Task updated successfully!", "success");
    } catch (error) {
        console.error("Error updating task:", error);
        showNotification("Failed to update task", "error");
    }
}

// Delete task (admin only)
async function deleteTask(taskId) {
    if (!isAdmin) {
        showNotification("Only admins can delete tasks", "error");
        return;
    }
    
    if (!confirm("Are you sure you want to delete this task?")) return;
    
    try {
        await db.ref(`tasks/${taskId}`).remove();
        showNotification("Task deleted successfully!", "success");
    } catch (error) {
        console.error("Error deleting task:", error);
        showNotification("Failed to delete task", "error");
    }
}

// ========== ADDITIONAL FUNCTIONS NEEDED ==========

// Filter tasks (called from admin.html)
function filterTasks() {
    const searchTerm = document.getElementById('adminSearch')?.value || '';
    const statusFilter = document.getElementById('filterStatus')?.value || '';
    
    if (typeof renderTasks === 'function') {
        renderTasks(searchTerm, statusFilter);
    }
}

// Get status icon (already exists above, but ensure it's exported)
function getStatusIcon(status) {
    switch(status) {
        case 'pending': return 'clock';
        case 'approved': return 'check-circle';
        case 'completed': return 'flag-checkered';
        case 'cancelled': return 'times-circle';
        case 'rejected': return 'times-circle';
        default: return 'question-circle';
    }
}

// Update approval count (called from admin.html)
function updateApprovalCount() {
    if (!tasks) return;
    
    const needsApprovalCount = Object.values(tasks).filter(task => {
        return task.needs_approval === true && 
               task.status === 'pending' &&
               !task.is_admin_request;
    }).length;
    
    // Update all elements that might show approval count
    const approvalElements = [
        document.getElementById('approvalCount'),
        document.getElementById('needsApprovalTasks')
    ];
    
    approvalElements.forEach(el => {
        if (el) {
            el.textContent = needsApprovalCount;
        }
    });
}

// Reject task with reason (called from admin.html)
function rejectTaskWithReason(taskId) {
    const reason = prompt("Please provide a reason for rejection (optional):", "");
    if (reason === null) return; // User cancelled
    
    rejectTask(taskId, reason);
}

// View requester details (called from admin.html)
function viewRequesterDetails(email) {
    // This would normally fetch from a team members database
    // For now, show basic info
    alert(`Requester: ${email}\n\nMore details would be available with a proper team database.`);
}

// Remove photo preview (called from admin.html)
function removePhotoPreview(element) {
    if (element && element.parentElement) {
        element.parentElement.remove();
    }
}

// Mark task as completed (for both admin and team)
async function markTaskComplete(taskId) {
    try {
        if (!currentUser) {
            showNotification("Please login first", "error");
            return false;
        }
        
        const taskRef = db.ref(`tasks/${taskId}`);
        const snapshot = await taskRef.once('value');
        const task = snapshot.val();
        
        if (!task) {
            showNotification("Task not found", "error");
            return false;
        }
        
        if (task.status === 'completed') {
            showNotification("Task is already completed", "info");
            return false;
        }
        
        if (task.status !== 'approved') {
            showNotification("Only approved tasks can be marked as completed", "error");
            return false;
        }
        
        // Check permissions
        if (!isAdmin) {
            // Team members can only complete tasks they created or are assigned to
            const canComplete = task.requested_by === currentUserEmail || 
                              task.assigned_to === currentUserEmail ||
                              task.assigned_to === currentUser;
            
            if (!canComplete) {
                showNotification("You can only complete tasks created by you or assigned to you", "error");
                return false;
            }
        }
        
        const updates = {
            status: 'completed',
            completed_by: currentUserEmail || currentUser,
            completed_at: new Date().toISOString(),
            last_updated: Date.now()
        };
        
        await taskRef.update(updates);
        showNotification("Task marked as completed!", "success");
        return true;
    } catch (error) {
        console.error("Error marking task complete:", error);
        showNotification("Failed to mark task as complete: " + error.message, "error");
        return false;
    }
}
// Mark task as completed - specifically for team members
async function markTaskCompleteForTeam(taskId) {
    try {
        if (!currentUser) {
            showNotification("Please login first", "error");
            return false;
        }
        
        const taskRef = db.ref(`tasks/${taskId}`);
        const snapshot = await taskRef.once('value');
        const task = snapshot.val();
        
        if (!task) {
            showNotification("Task not found", "error");
            return false;
        }
        
        if (task.status === 'completed') {
            showNotification("Task is already completed", "info");
            return false;
        }
        
        if (task.status !== 'approved') {
            showNotification("Only approved tasks can be marked as completed", "error");
            return false;
        }
        
        // Team members can only complete tasks they created or are assigned to
        const canComplete = task.requested_by === currentUserEmail || 
                          task.assigned_to === currentUserEmail ||
                          task.assigned_to === currentUser;
        
        if (!canComplete) {
            showNotification("You can only complete tasks created by you or assigned to you", "error");
            return false;
        }
        
        const updates = {
            status: 'completed',
            completed_by: currentUser,
            completed_at: new Date().toISOString(),
            last_updated: Date.now()
        };
        
        await taskRef.update(updates);
        showNotification("Task marked as completed!", "success");
        return true;
    } catch (error) {
        console.error("Error marking task complete:", error);
        showNotification("Failed to mark task as complete: " + error.message, "error");
        return false;
    }
}
// Mark task as completed - specifically for team members - ENHANCED VERSION
async function markTaskCompleteForTeam(taskId) {
    try {
        if (!currentUser) {
            showNotification("Please login first", "error");
            return false;
        }
        
        // Get saved user data
        const savedUser = JSON.parse(localStorage.getItem('greenfield_user') || '{}');
        const userName = savedUser.name || currentUser;
        
        // Ask for confirmation
        if (!confirm(`Are you sure you want to mark this task as completed?\n\nThis action will be recorded as completed by: ${userName}`)) {
            return false;
        }
        
        showNotification("Marking task as complete...", "info");
        
        const taskRef = db.ref(`tasks/${taskId}`);
        const snapshot = await taskRef.once('value');
        const task = snapshot.val();
        
        if (!task) {
            showNotification("Task not found", "error");
            return false;
        }
        
        if (task.status === 'completed') {
            showNotification("Task is already completed", "info");
            return false;
        }
        
        if (task.status !== 'approved') {
            showNotification("Only approved tasks can be marked as completed", "error");
            return false;
        }
        
        // Team members can only complete tasks they created or are assigned to
        const canComplete = task.requested_by === currentUserEmail || 
                          task.assigned_to === currentUserEmail ||
                          task.assigned_to === currentUser ||
                          task.assigned_to === userName;
        
        if (!canComplete) {
            showNotification("You can only complete tasks created by you or assigned to you", "error");
            return false;
        }
        
        const now = new Date();
        const completedAt = now.toISOString();
        const completedDateFormatted = now.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const updates = {
            status: 'completed',
            completed_by: userName,
            completed_by_email: currentUserEmail,
            completed_at: completedAt,
            completed_date: completedDateFormatted,
            last_updated: Date.now(),
            is_visible_to_all: true
        };
        
        await taskRef.update(updates);
        
        showNotification(`✅ Task marked as completed!\nCompleted by: ${userName}\nDate: ${completedDateFormatted}`, "success");
        
        // The real-time listener will automatically update the UI
        return true;
    } catch (error) {
        console.error("Error marking task complete:", error);
        showNotification("Failed to mark task as complete: " + error.message, "error");
        return false;
    }  
// Mark task as completed for team members - ROBUST VERSION
async function markTaskCompleteForTeam(taskId) {
    console.log("markTaskCompleteForTeam called for task:", taskId);
    
    try {
        if (!currentUser) {
            showNotification("Please login first", "error");
            return false;
        }
        
        // Get user data from localStorage
        const savedUser = JSON.parse(localStorage.getItem('greenfield_user') || '{}');
        console.log("Current user data:", savedUser);
        
        const userName = savedUser.name || currentUser;
        const userEmail = savedUser.email || currentUserEmail;
        
        // Ask for confirmation
        if (!confirm(`Mark this task as completed?\n\nYou will be recorded as: ${userName}`)) {
            console.log("User cancelled the operation");
            return false;
        }
        
        console.log("Proceeding with marking task as complete...");
        
        const taskRef = db.ref(`tasks/${taskId}`);
        const snapshot = await taskRef.once('value');
        const task = snapshot.val();
        
        console.log("Task data retrieved:", task);
        
        if (!task) {
            showNotification("Task not found", "error");
            return false;
        }
        
        if (task.status === 'completed') {
            showNotification("Task is already completed", "info");
            return false;
        }
        
        if (task.status !== 'approved') {
            showNotification("Only approved tasks can be marked as completed", "error");
            return false;
        }
        
        // Check if user can complete this task
        const canComplete = task.requested_by === userEmail || 
                          task.assigned_to === userEmail ||
                          task.assigned_to === currentUser ||
                          task.assigned_to === userName;
        
        console.log("Permission check:", {
            requested_by: task.requested_by,
            userEmail: userEmail,
            assigned_to: task.assigned_to,
            currentUser: currentUser,
            userName: userName,
            canComplete: canComplete
        });
        
        if (!canComplete) {
            showNotification("You can only complete tasks created by you or assigned to you", "error");
            return false;
        }
        
        const now = new Date();
        const completedAt = now.toISOString();
        const completedDateFormatted = now.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const updates = {
            status: 'completed',
            completed_by: userName,
            completed_by_email: userEmail,
            completed_at: completedAt,
            completed_date: completedDateFormatted,
            last_updated: Date.now(),
            is_visible_to_all: true
        };
        
        console.log("Updating task with:", updates);
        
        await taskRef.update(updates);
        
        showNotification(`✅ Task marked as completed!\nCompleted by: ${userName}`, "success");
        
        console.log("Task successfully marked as completed");
        return true;
    } catch (error) {
        console.error("Error in markTaskCompleteForTeam:", error);
        showNotification("Failed to mark task as complete: " + error.message, "error");
        return false;
    }
}
// Test function
function testMarkComplete() {
    console.log("Testing mark complete functionality...");
    console.log("Current user:", currentUser);
    console.log("Current user email:", currentUserEmail);
    console.log("Is admin:", isAdmin);
    console.log("Tasks loaded:", Object.keys(tasks || {}).length);
    
    // Find an approved task the user can complete
    const allTasks = Object.entries(tasks || {});
    const approvedTasks = allTasks.filter(([taskId, task]) => {
        return task.status === 'approved';
    });
    
    console.log("Approved tasks found:", approvedTasks.length);
    
    if (approvedTasks.length > 0) {
        const [taskId, task] = approvedTasks[0];
        console.log("Testing with task:", taskId, task);
        handleMarkComplete(taskId);
    } else {
        alert("No approved tasks found to test with");
    }
}     
}
// Make functions available globally
window.approveTask = approveTask;
window.rejectTask = rejectTask;
window.updateTaskStatus = updateTaskStatus;
window.showNotification = showNotification;
window.addTask = addTask;
window.convertImageToBase64 = convertImageToBase64;
window.exportToExcel = exportToExcel;
window.openPhotoModal = openPhotoModal;
window.editTask = editTask;
window.deleteTask = deleteTask;
window.filterTasks = filterTasks;
window.renderTasks = renderTasks;
window.updateTaskCount = updateTaskCount;
window.updateStats = updateStats;
window.getStatusIcon = getStatusIcon;
window.updateApprovalCount = updateApprovalCount;
window.rejectTaskWithReason = rejectTaskWithReason;
window.viewRequesterDetails = viewRequesterDetails;
window.removePhotoPreview = removePhotoPreview;
window.showLoading = showLoading;
window.markTaskComplete = markTaskComplete;
window.markTaskCompleteForTeam = markTaskCompleteForTeam;
// Also export functions needed for team.html
window.logout = function() {
    currentUser = null;
    currentUserEmail = "";
    isAdmin = false;
    localStorage.removeItem('greenfield_user');
    window.location.href = 'index.html';
};