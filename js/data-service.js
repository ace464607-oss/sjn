import { firebaseConfig } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
    getDatabase, ref, get, set, push, update, remove, 
    serverTimestamp, query, limitToLast, orderByChild, equalTo 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, get, query, limitToLast, orderByChild, equalTo, push, set, update, remove };

// ==========================================
// [1] 통신사 데이터
// ==========================================
export async function getFullData() {
    try {
        const snapshot = await get(ref(db, '/telecomData'));
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error("Error fetching telecom data:", error);
        return null;
    }
}

export async function saveData(data) {
    try {
        await push(ref(db, '/activityLog'), {
            user: "admin",
            timestamp: serverTimestamp(),
            message: "전체 데이터가 저장되었습니다.",
        });
        await set(ref(db, '/telecomData'), data);
        return true;
    } catch (error) {
        console.error("Error saving data:", error);
        return false;
    }
}

// ==========================================
// [2] 상담사(Manager) 관리
// ==========================================
export async function getManagers() {
    try {
        const snapshot = await get(ref(db, '/managers'));
        if (snapshot.exists()) {
            return Object.entries(snapshot.val()).map(([key, value]) => ({
                id: key,
                ...value
            }));
        }
        return [];
    } catch (error) {
        console.error("Error fetching managers:", error);
        return [];
    }
}

export async function addManager(managerData) {
    try {
        const newRef = push(ref(db, '/managers'));
        await set(newRef, managerData);
        return true;
    } catch (error) {
        console.error("Error adding manager:", error);
        return false;
    }
}

export async function updateManager(managerId, managerData) {
    try {
        await update(ref(db, `/managers/${managerId}`), managerData);
        return true;
    } catch (error) {
        console.error("Error updating manager:", error);
        return false;
    }
}

export async function deleteManager(managerId) {
    try {
        await remove(ref(db, `/managers/${managerId}`));
        return true;
    } catch (error) {
        console.error("Error deleting manager:", error);
        return false;
    }
}

// ==========================================
// [3] 고객(CRM) 관리
// ==========================================
export async function addCustomerLead(managerId, customerData) {
    try {
        const targetId = managerId || 'unassigned';
        const newRef = push(ref(db, `/customers/${targetId}`));
        
        const payload = {
            ...customerData,
            createdAt: serverTimestamp(),
            status: '접수'
        };
        
        await set(newRef, payload);
        return newRef.key;
    } catch (error) {
        console.error("Error adding customer lead:", error);
        return null;
    }
}

export async function getCustomersByManager(managerId) {
    try {
        // managerId가 유효하지 않으면 빈 배열 반환
        if (!managerId) return [];

        const snapshot = await get(ref(db, `/customers/${managerId}`));
        if (snapshot.exists()) {
            return Object.entries(snapshot.val()).map(([key, value]) => ({
                id: key,
                ...value
            })).sort((a, b) => b.createdAt - a.createdAt);
        }
        return []; // 데이터가 없으면 빈 배열 반환
    } catch (error) {
        console.error("Error fetching customers:", error);
        return []; // 에러 발생 시에도 빈 배열 반환하여 UI 멈춤 방지
    }
}

export async function updateCustomerStatus(managerId, customerId, newStatus) {
    try {
        await update(ref(db, `/customers/${managerId}/${customerId}`), {
            status: newStatus,
            updatedAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Error updating status:", error);
        return false;
    }
}

// [신규] 미배정 고객을 특정 상담사에게 배정 (이동)
export async function assignCustomerToManager(customerId, managerId) {
    try {
        // 1. 미배정 경로에서 데이터 읽기
        const sourceRef = ref(db, `/customers/unassigned/${customerId}`);
        const snapshot = await get(sourceRef);
        
        if (!snapshot.exists()) return false;
        const customerData = snapshot.val();

        // 2. 상담사 경로에 데이터 쓰기 (상태: 접수, 배정일시 추가)
        const targetRef = ref(db, `/customers/${managerId}/${customerId}`);
        await set(targetRef, {
            ...customerData,
            status: '접수',
            assignedAt: serverTimestamp()
        });

        // 3. 미배정 경로에서 데이터 삭제
        await remove(sourceRef);
        
        return true;
    } catch (error) {
        console.error("Error assigning customer:", error);
        return false;
    }
}

// ==========================================
// [4] 단축 견적서 (Short Quote)
// ==========================================
export async function createShortQuote(quoteData) {
    try {
        const shortId = Math.random().toString(36).substring(2, 8);
        await set(ref(db, `/quotes/${shortId}`), {
            ...quoteData,
            createdAt: serverTimestamp()
        });
        return shortId;
    } catch (error) {
        console.error("Error creating short quote:", error);
        return null;
    }
}

export async function getQuoteById(shortId) {
    try {
        const snapshot = await get(ref(db, `/quotes/${shortId}`));
        if (snapshot.exists()) {
            return snapshot.val();
        }
        return null;
    } catch (error) {
        console.error("Error fetching quote:", error);
        return null;
    }
}