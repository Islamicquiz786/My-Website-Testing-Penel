import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  addDoc,
  serverTimestamp,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBasuAzvAlaVAayEdDU9bB9wvUzG7fVuAg",
  authDomain: "islamic-quiz-website.firebaseapp.com",
  projectId: "islamic-quiz-website",
  storageBucket: "islamic-quiz-website.appspot.com",
  messagingSenderId: "517259698394",
  appId: "1:517259698394:web:36094d03187da81685e3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const signOutBtn = document.getElementById('signOutBtn');
const userTableBody = document.getElementById('userTableBody');
const withdrawalTableBody = document.getElementById('withdrawalTableBody');
const notificationForm = document.getElementById('notificationForm');
const notificationList = document.getElementById('notificationList');
const userSearch = document.getElementById('userSearch');
const currentDate = document.getElementById('currentDate');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');

// Current Date Display
currentDate.textContent = new Date().toLocaleDateString('en-US', { 
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
});

// Pagination Variables
let currentPage = 1;
const usersPerPage = 10;

// Load Users with Pagination
async function loadUsers(page = 1) {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef);
    const querySnapshot = await getDocs(q);
    
    const allUsers = [];
    querySnapshot.forEach((doc) => {
      allUsers.push({ id: doc.id, ...doc.data() });
    });

    const totalPages = Math.ceil(allUsers.length / usersPerPage);
    const startIndex = (page - 1) * usersPerPage;
    const paginatedUsers = allUsers.slice(startIndex, startIndex + usersPerPage);

    userTableBody.innerHTML = '';

    if (paginatedUsers.length === 0) {
      userTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No users found</td></tr>';
      return;
    }

    paginatedUsers.forEach((user) => {
      const statusClass = user.isApproved ? 'bg-success' : 'bg-warning';
      const statusText = user.isApproved ? 'Approved' : 'Pending';
      
      userTableBody.innerHTML += `
        <tr>
          <td>${user.id.substring(0, 8)}...</td>
          <td>${user.name || 'N/A'}</td>
          <td>${user.email}</td>
          <td>${user.plan || 'Free'}</td>
          <td>${user.paymentStatus || 'Pending'}</td>
          <td><span class="badge ${statusClass}">${statusText}</span></td>
          <td>
            ${!user.isApproved ? `
              <button class="btn btn-sm btn-success me-2" onclick="approveUser('${user.id}')">
                <i class="fas fa-check"></i> Approve
              </button>
            ` : ''}
            <button class="btn btn-sm btn-danger" onclick="banUser('${user.id}')">
              <i class="fas fa-ban"></i> Ban
            </button>
          </td>
        </tr>
      `;
    });

    // Update pagination buttons
    prevPageBtn.classList.toggle('disabled', page === 1);
    nextPageBtn.classList.toggle('disabled', page >= totalPages);

    currentPage = page;
  } catch (error) {
    console.error("Error loading users: ", error);
    userTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Error loading users</td></tr>';
  }
}

// Load Withdrawals
async function loadWithdrawals() {
  try {
    const withdrawalsRef = collection(db, 'withdrawals');
    const q = query(withdrawalsRef, where('status', '==', 'pending'));
    const querySnapshot = await getDocs(q);

    withdrawalTableBody.innerHTML = '';

    if (querySnapshot.empty) {
      withdrawalTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No pending withdrawals</td></tr>';
      return;
    }

    querySnapshot.forEach((doc) => {
      const withdrawal = doc.data();
      
      withdrawalTableBody.innerHTML += `
        <tr>
          <td>${doc.id.substring(0, 6)}...</td>
          <td>${withdrawal.userId.substring(0, 8)}...</td>
          <td>$${withdrawal.amount}</td>
          <td>${withdrawal.accountNumber}</td>
          <td>${withdrawal.method}</td>
          <td><span class="badge bg-warning">Pending</span></td>
          <td>
            <button class="btn btn-sm btn-success me-2 approve-btn" data-id="${doc.id}">
              <i class="fas fa-check"></i> Approve
            </button>
            <button class="btn btn-sm btn-danger reject-btn" data-id="${doc.id}">
              <i class="fas fa-times"></i> Reject
            </button>
          </td>
        </tr>
      `;
    });

    // Add event listeners to buttons
    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        await updateWithdrawalStatus(e.target.dataset.id, 'approved');
      });
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        await updateWithdrawalStatus(e.target.dataset.id, 'rejected');
      });
    });
  } catch (error) {
    console.error("Error loading withdrawals: ", error);
    withdrawalTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Error loading withdrawals</td></tr>';
  }
}

// Update Withdrawal Status
async function updateWithdrawalStatus(id, status) {
  try {
    await updateDoc(doc(db, 'withdrawals', id), {
      status: status,
      processedAt: serverTimestamp()
    });
    alert(`Withdrawal ${status} successfully!`);
    loadWithdrawals();
  } catch (error) {
    alert('Error updating withdrawal: ' + error.message);
  }
}

// Send Notification
notificationForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const targetUser = document.getElementById('targetUser').value;
  const title = document.getElementById('notificationTitle').value;
  const message = document.getElementById('notificationMessage').value;

  try {
    await addDoc(collection(db, 'notifications'), {
      title: title,
      message: message,
      userId: targetUser || 'all',
      createdAt: serverTimestamp(),
      read: false
    });

    alert('Notification sent successfully!');
    notificationForm.reset();
    loadNotifications();
  } catch (error) {
    alert('Error sending notification: ' + error.message);
  }
});

// Load Notifications
async function loadNotifications() {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(5));
    const querySnapshot = await getDocs(q);

    notificationList.innerHTML = '';

    querySnapshot.forEach((doc) => {
      const notification = doc.data();
      const date = notification.createdAt?.toDate().toLocaleString() || 'Just now';
      
      notificationList.innerHTML += `
        <div class="list-group-item">
          <div class="d-flex justify-content-between">
            <h6 class="mb-1">${notification.title}</h6>
            <small>${date}</small>
          </div>
          <p class="mb-1">${notification.message}</p>
          <small>Sent to: ${notification.userId === 'all' ? 'All Users' : notification.userId.substring(0, 8) + '...'}</small>
        </div>
      `;
    });
  } catch (error) {
    console.error("Error loading notifications: ", error);
  }
}

// Approve User
window.approveUser = async (userId) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      isApproved: true,
      approvedAt: serverTimestamp()
    });
    alert('User approved successfully!');
    loadUsers(currentPage);
  } catch (error) {
    alert('Error approving user: ' + error.message);
  }
};

// Ban User
window.banUser = async (userId) => {
  if (confirm('Are you sure you want to ban this user?')) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isBanned: true,
        bannedAt: serverTimestamp()
      });
      alert('User banned successfully!');
      loadUsers(currentPage);
    } catch (error) {
      alert('Error banning user: ' + error.message);
    }
  }
};

// Pagination Controls
prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    loadUsers(currentPage - 1);
  }
});

nextPageBtn.addEventListener('click', () => {
  loadUsers(currentPage + 1);
});

// Sign Out Function
signOutBtn.addEventListener('click', () => {
  signOut(auth).then(() => {
    window.location.href = 'login.html';
  }).catch((error) => {
    alert('Sign out failed: ' + error.message);
  });
});

// Search Users
document.getElementById('searchBtn').addEventListener('click', () => {
  loadUsers(1); // Reset to first page when searching
});

// Check Auth State
onAuthStateChanged(auth, (user) => {
  if (!user || user.uid !== "3we75n5JccPIakzzavWVcpYyW5f1") {
    window.location.href = 'login.html';
  } else {
    // Load all data when authenticated
    loadUsers();
    loadWithdrawals();
    loadNotifications();
  }
});
