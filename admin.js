import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, onSnapshot, query, orderBy,
  updateDoc, addDoc, limit, startAfter, getDocs, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import Chart from "https://cdn.jsdelivr.net/npm/chart.js";

const firebaseConfig = {
  apiKey: "AIzaSyBasuAzvAlaVAayEdDU9bB9wvUzG7fVuAg",
  authDomain: "islamic-quiz-website.firebaseapp.com",
  projectId: "islamic-quiz-website",
  storageBucket: "islamic-quiz-website.appspot.com",
  messagingSenderId: "517259698394",
  appId: "1:517259698394:web:36094d03187da81685e3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_UIDS = ["3we75n5JccPIakzzavWVcpYyW5f1"];
let lastDoc = null, currentPage = 1, pageSize = 10;

onAuthStateChanged(auth, user => {
  if (!user || !ADMIN_UIDS.includes(user.uid)) {
    alert("صرف Admin کو اجازت ہے");
    signOut(auth);
    location = "admin-login.html";
    return;
  }
  loadUsers();
  loadWithdrawals();
  loadNotifications();
});

signOutBtn.onclick = () => signOut(auth);

async function loadUsers(forward = false) {
  const tbody = document.querySelector("#usersTable tbody");
  const search = document.getElementById("searchInput").value.toLowerCase();
  const filter = document.getElementById("statusFilter").value;
  let usersQuery = query(collection(db, "users"), orderBy("createDate", "desc"), limit(pageSize));
  if (forward && lastDoc) {
    usersQuery = query(usersQuery, startAfter(lastDoc));
  }
  const snap = await getDocs(usersQuery);
  tbody.innerHTML = "";
  snap.forEach((docSnap, i) => {
    const d = docSnap.data(), id = docSnap.id;
    lastDoc = docSnap;
    const status = d.approved ? "Approved" : (d.withdrawRequested ? "Pending" : "New");
    if ((!filter || filter === status) && (!search || (d.username || "").toLowerCase().includes(search) || (d.email || "").toLowerCase().includes(search))) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${id}</td><td>${d.username || "—"}</td><td>${d.email || "—"}</td><td>${d.plan || "—"}</td>
        <td>${d.paymentMethod || "—"}</td><td>${d.withdrawAmount || "—"}</td><td>${status}</td>
        <td>${d.device ? d.device.platform + " " + d.device.screenWidth + "x" + d.device.screenHeight : "—"}</td>
        <td>${d.referralCode || ""}/${d.referredBy || ""}</td><td>${d.earnings || 0}</td>
        <td>
          ${!d.approved ? `<button data-id="${id}" class="approve">Approve</button>` : ""}
          <button data-id="${id}" class="refuse">Refuse</button>
          <button data-id="${id}" class="block">Block</button>
        </td>`;
      tbody.appendChild(tr);
    }
  });
  document.getElementById("pageNum").innerText = currentPage;
  document.getElementById("nextPage").onclick = () => { currentPage++; loadUsers(true); };
}

document.getElementById("searchInput").oninput = () => loadUsers();
document.getElementById("statusFilter").onchange = () => loadUsers();

document.querySelector("#usersTable").addEventListener("click", e => {
  if (e.target.matches(".approve")) updateUser(e.target.dataset.id, true);
  if (e.target.matches(".refuse")) updateUser(e.target.dataset.id, false);
  if (e.target.matches(".block")) updateUser(e.target.dataset.id, false, true);
});

async function updateUser(id, approve, block = false) {
  const upd = { approved: !!approve };
  if (block) upd.withdrawRequested = false;
  await updateDoc(doc(db, "users", id), upd);
}

function loadWithdrawals() {
  const tbody = document.querySelector("#withdrawTable tbody");
  onSnapshot(collection(db, "withdrawRequests"), snap => {
    tbody.innerHTML = "";
    snap.forEach(r => {
      const d = r.data(), rid = r.id;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${rid}</td><td>${d.userId}</td><td>${d.amount}</td>
        <td>${d.accountNumber}</td><td>${d.method}</td><td>${d.status}</td>
        <td>${d.status === "pending" ? `<button data-id="${rid}" class="approveW">Approve</button>` : ""}</td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll(".approveW").forEach(btn =>
      updateDoc(doc(db, "withdrawRequests", btn.dataset.id), { status: "approved" })
    );
  });
}

function loadNotifications() {
  const form = document.getElementById("notifForm");
  const table = document.querySelector("#notifTable tbody");
  form.onsubmit = async e => {
    e.preventDefault();
    await addDoc(collection(db, "notifications"), {
      userId: form.notifUserId.value || null,
      title: form.notifTitle.value,
      message: form.notifMessage.value,
      sentAt: new Date(),
      read: false
    });
    alert("Notification sent");
    form.reset();
  };
  onSnapshot(collection(db, "notifications"), snap => {
    table.innerHTML = "";
    snap.forEach(n => {
      const d = n.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${d.userId || "All"}</td><td>${d.title}</td><td>${d.message}</td>
        <td>${d.sentAt.toDate().toLocaleString()}</td><td>${d.read}</td>`;
      table.appendChild(tr);
    });
  });
}

onSnapshot(collection(db, "users"), snap => {
  const planCounts = {};
  snap.forEach(u => { planCounts[u.data().plan] = (planCounts[u.data().plan] || 0) + 1; });
  const labels = Object.keys(planCounts), data = Object.values(planCounts);
  const ctx = document.getElementById("quizChart").getContext("2d");
  new Chart(ctx, { type: "bar", data: { labels, datasets: [{ label: "Users per plan", data }] } });
});
