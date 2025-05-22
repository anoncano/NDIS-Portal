// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut as fbSignOut, 
    onAuthStateChanged,
    signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// Firestore imports
import { 
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    getDocs,
    query,
    where,
    serverTimestamp, 
    writeBatch,
    runTransaction,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Firebase Storage imports (Add if/when implementing file uploads)
// import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";


/* ========== DOM helpers ========== */
const $ = q => document.querySelector(q);
const $$ = q => [...document.querySelectorAll(q)];

/* ========== Firebase Global Variables & Config ========== */
let fbApp;
let fbAuth;
let fsDb; 
// let fbStorage; // Uncomment when Firebase Storage is implemented
let currentUserId = null; 

const firebaseConfig = window.firebaseConfigForApp; 
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

/* ========== UI Element References ========== */
const authScreenElement = $("#authScreen");
const portalAppElement = $("#portalApp");
const loadingOverlayElement = $("#loadingOverlay");
const authStatusMessageElement = $("#authStatusMessage");

/* ========== Local State Variables ========== */
let accounts = {}; 
let currentUserEmail = null; 
let profile = {}; 
let globalSettings = {}; 
let adminManagedServices = []; 
let currentInvoiceData = { items: [], invoiceNumber: "", invoiceDate: "", subtotal: 0, gst: 0, grandTotal: 0 }; // Holds current invoice state

let agreementCustomData; 
try {
    agreementCustomData = { 
        overallTitle: "NDIS Service Agreement", 
        clauses: [ 
            { heading: "1. Parties", body: "This Service Agreement is between:\n\n**The Participant:** {{participantName}} (NDIS No: {{participantNdisNo}})\n\nand\n\n**The Provider (Support Worker):** {{workerName}} (ABN: {{workerAbn}})" },
            { heading: "2. Purpose of this Agreement", body: "This Service Agreement outlines the supports that {{workerName}} will provide to {{participantName}}, the costs of these supports, and the terms and conditions under which these supports will be delivered." },
            { heading: "3. Agreed Supports & Services", body: "The following NDIS supports will be provided under this agreement:\n\n{{serviceList}}\n\n<em>Detailed rates for specific times (e.g., evening, weekend) for the above services are as per the NDIS Pricing Arrangements and Price Limits and are available from the provider upon request. Travel costs, where applicable, will be based on the agreed NDIS travel item code and its defined rate.</em>" },
            { heading: "4. Responsibilities of the Provider", body: "<ul><li>Deliver services in a safe, respectful, and professional manner.</li><li>Work collaboratively with the participant and their support network.</li><li>Maintain accurate records of services provided.</li><li>Adhere to NDIS Code of Conduct.</li></ul>" },
            { heading: "5. Responsibilities of the Participant", body: "<ul><li>Treat the provider with courtesy and respect.</li><li>Provide a safe working environment.</li><li>Communicate needs and preferences clearly.</li><li>Provide timely notification of any changes or cancellations.</li></ul>" },
            { heading: "6. Payments", body: "Invoices for services will be issued (typically weekly/fortnightly) to the Participant or their nominated Plan Manager. Payment terms are 14 days from the date of invoice unless otherwise agreed." },
            { heading: "7. Changes and Cancellations", body: "Changes to agreed supports or schedules should be communicated with at least 24 hours' notice where possible. Cancellations with less than 24 hours' notice may be subject to a cancellation fee as per NDIS guidelines and the terms agreed with the provider." },
            { heading: "8. Feedback, Complaints, and Disputes", body: "Any feedback, complaints, or disputes will be managed respectfully and promptly. Please contact {{workerName}} directly in the first instance. If unresolved, the NDIS Quality and Safeguards Commission can be contacted." },
            { heading: "9. Agreement Term and Review", body: "This agreement will commence on {{agreementStartDate}} and will remain in effect until {{agreementEndDate}}, or until terminated by either party with (e.g., 14 days) written notice. This agreement will be reviewed at least annually, or as requested by either party." }
        ]
    };
} catch (e) {
    console.error("CRITICAL ERROR initializing agreementCustomData object:", e);
    agreementCustomData = {
        overallTitle: "Default Agreement (Error)",
        clauses: [{ heading: "Error", body: "Could not load agreement clauses." }]
    };
}

const RATE_CATEGORIES = ["weekday", "evening", "night", "saturday", "sunday", "public"];
const SERVICE_CATEGORY_TYPES = {
    CORE_STANDARD: 'core_standard', 
    CORE_HIGH_INTENSITY: 'core_high_intensity', 
    CAPACITY_THERAPY_STD: 'capacity_therapy_std',
    CAPACITY_SPECIALIST: 'capacity_specialist', 
    TRAVEL_KM: 'travel_km', 
    OTHER_FLAT_RATE: 'other_flat_rate'
};
let canvas, ctx, pen = false;
let currentAgreementWorkerEmail = null; 
let signingAs = 'worker'; 
let isFirebaseInitialized = false;
let initialAuthComplete = false;
let selectedWorkerEmailForAuth = null; 
let currentTimePickerStep, selectedMinute, selectedHour12, selectedAmPm, activeTimeInput, timePickerCallback;
let adminWizStep = 1; 
let userWizStep = 1; 

/* ========== Loading Overlay ========== */
function showLoading(message = "Loading...") {
    if (loadingOverlayElement) {
        loadingOverlayElement.querySelector('p').textContent = message;
        loadingOverlayElement.style.display = "flex";
    }
}
function hideLoading() {
    if (loadingOverlayElement) {
        loadingOverlayElement.style.display = "none";
    }
}

/* ========== Auth Status Message on Auth Screen ========== */
function showAuthStatusMessage(message, isError = true) {
    if (authStatusMessageElement) {
        authStatusMessageElement.textContent = message;
        authStatusMessageElement.style.color = isError ? 'var(--danger)' : 'var(--ok)';
        authStatusMessageElement.style.display = message ? 'block' : 'none';
    }
}

/* ========== Generic Modal & Alert & Utility Functions ========== */
function showMessage(title, text) { 
    const mt = $("#messageModalTitle"), mtxt = $("#messageModalText"), mm = $("#messageModal"); 
    if (mt) mt.innerHTML = `<i class="fas fa-info-circle"></i> ${title}`; 
    if (mtxt) mtxt.innerHTML = text; 
    if (mm) { 
        mm.classList.remove('hide'); 
        mm.style.display = "flex"; 
    } 
}

window.closeModal = function(modalId) { 
    const modal = $(`#${modalId}`);
    if (modal) {
        modal.style.display = "none";
    }
    if (modalId === 'messageModal' && authStatusMessageElement) { 
        showAuthStatusMessage(""); 
    }
    if (modalId === 'customTimePicker') {
        const picker = $("#customTimePicker");
        if (picker) picker.classList.add('hide');
    }
};

function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase()); }
function formatDateForInvoiceDisplay(dateInput) {
    if (!dateInput) return "";
    let date;
    if (typeof dateInput === 'string' && dateInput.match(/^\d{4}-\d{2}-\d{2}/)) { date = new Date(dateInput); } 
    else if (typeof dateInput === 'number') { date = new Date(dateInput); } 
    else if (dateInput && dateInput.toDate) { date = dateInput.toDate(); } 
    else if (dateInput instanceof Date) { date = dateInput; } 
    else { console.warn("Unrecognized date format:", dateInput); return "Invalid Date"; }
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    return `${correctedDate.getDate()} ${correctedDate.toLocaleString('en-AU', { month: 'short' })} ${correctedDate.getFullYear().toString().slice(-2)}`;
}
function timeToMinutes(timeStr) { if (!timeStr) return 0; const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; }

function calculateHours(startTime24, endTime24) {
    if (!startTime24 || !endTime24) return 0;
    const startMinutes = timeToMinutes(startTime24);
    const endMinutes = timeToMinutes(endTime24);
    if (endMinutes < startMinutes) return 0; 
    return (endMinutes - startMinutes) / 60;
}

function determineRateType(dateStr, startTime24) { 
    if (!dateStr || !startTime24) return "weekday"; 
    const date = new Date(dateStr); 
    const day = date.getDay(); 
    const hr = parseInt(startTime24.split(':')[0],10); 

    if (day === 0) return "sunday"; 
    if (day === 6) return "saturday"; 
    if (hr >= 20) return "evening"; 
    if (hr < 6) return "night";   
    return "weekday"; 
}
function formatTime12Hour(t24){if(!t24)return"";const [h,m]=t24.split(':'),hr=parseInt(h,10);if(isNaN(hr)||isNaN(parseInt(m,10)))return"";const ap=hr>=12?'PM':'AM';let hr12=hr%12;hr12=hr12?hr12:12;return`${String(hr12).padStart(2,'0')}:${m} ${ap}`;}

/* ========== Input Validation Helpers ========== */
function isValidABN(abn) {
    if (!abn || typeof abn !== 'string') return false;
    const cleanedAbn = abn.replace(/\s/g, ''); 
    if (!/^\d{11}$/.test(cleanedAbn)) return false; 

    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    let sum = 0;
    for (let i = 0; i < 11; i++) {
        let digit = parseInt(cleanedAbn[i], 10);
        if (i === 0) digit -= 1; 
        sum += digit * weights[i];
    }
    return (sum % 89) === 0;
}

function isValidBSB(bsb) {
    if (!bsb || typeof bsb !== 'string') return false;
    const cleanedBsb = bsb.replace(/[\s-]/g, ''); 
    return /^\d{6}$/.test(cleanedBsb); 
}

function isValidAccountNumber(acc) {
    if (!acc || typeof acc !== 'string') return false;
    const cleanedAcc = acc.replace(/\s/g, ''); 
    return /^\d{6,10}$/.test(cleanedAcc); 
}


/* ========== Firebase Initialization and Auth State ========== */
async function initializeFirebase() {
    console.log("Attempting to initialize Firebase with config:", JSON.stringify(window.firebaseConfigForApp, null, 2));
    
    const currentFirebaseConfig = window.firebaseConfigForApp; 
    if (!currentFirebaseConfig || 
        !currentFirebaseConfig.apiKey || currentFirebaseConfig.apiKey.startsWith("YOUR_") ||
        !currentFirebaseConfig.authDomain || 
        !currentFirebaseConfig.projectId || 
        !currentFirebaseConfig.storageBucket || 
        !currentFirebaseConfig.messagingSenderId || 
        !currentFirebaseConfig.appId || currentFirebaseConfig.appId.startsWith("YOUR_") || currentFirebaseConfig.appId === "") {
        console.error("Firebase configuration is missing or incomplete in window.firebaseConfigForApp.");
        if (authScreenElement) authScreenElement.style.display = "flex";
        if (portalAppElement) portalAppElement.style.display = "none";
        showAuthStatusMessage("System Error: Portal configuration is invalid. Cannot connect.");
        hideLoading(); 
        isFirebaseInitialized = false; 
        return; 
    }

    try {
        fbApp = initializeApp(currentFirebaseConfig); 
        fbAuth = getAuth(fbApp);
        fsDb = getFirestore(fbApp); 
        // fbStorage = getStorage(fbApp); 

        if (!fbAuth || !fsDb) { 
            console.error("Failed to get Firebase Auth or Firestore instance.");
            if (authScreenElement) authScreenElement.style.display = "flex";
            if (portalAppElement) portalAppElement.style.display = "none";
            showAuthStatusMessage("System Error: Core services failed to initialize.");
            hideLoading();
            isFirebaseInitialized = false;
            return;
        }

        isFirebaseInitialized = true;
        console.log("Firebase initialized with Cloud Firestore.");
        await setupAuthListener(); 
    } catch (error) {
        console.error("Firebase initialization error:", error);
        if (authScreenElement) authScreenElement.style.display = "flex";
        if (portalAppElement) portalAppElement.style.display = "none";
        showAuthStatusMessage("System Error: Could not connect to backend services. " + error.message);
        hideLoading();
        isFirebaseInitialized = false; 
    }
}

async function setupAuthListener() {
    return new Promise((resolve) => {
        onAuthStateChanged(fbAuth, async (user) => {
            showLoading("Authenticating...");
            showAuthStatusMessage("", false); 
            try {
                if (user) {
                    currentUserId = user.uid; 
                    currentUserEmail = user.email; 
                    if($("#userIdDisplay")) $("#userIdDisplay").textContent = currentUserId + (user.email ? ` (${user.email})` : " (Anonymous)");
                    if($("#logoutBtn")) $("#logoutBtn").classList.remove('hide');
                    
                    if (authScreenElement) authScreenElement.style.display = "none"; 
                    if (portalAppElement) portalAppElement.style.display = "flex"; 

                    const userProfileData = await loadUserProfileFromFirestore(currentUserId);
                    await loadGlobalSettingsFromFirestore(); 

                    if (userProfileData) {
                        profile = userProfileData;
                        if (profile.email) accounts[profile.email] = { name: profile.name, profile: profile };
                        else accounts[currentUserId] = { name: profile.name, profile: profile };

                        if (profile.isAdmin) {
                            await loadAllDataForAdmin(); 
                            if (!globalSettings.setupComplete) {
                                openAdminSetupWizard();
                            } else {
                                enterPortal(true);
                            }
                        } else { 
                            await loadAllDataForUser(); 
                            if (globalSettings.portalType === 'organization' && (!profile.abn || !profile.bsb || !profile.acc || !profile.profileSetupComplete)) {
                                openUserSetupWizard(); 
                            } else {
                                enterPortal(false);
                            }
                        }
                    } else if (currentUserEmail && currentUserEmail.toLowerCase() === "admin@portal.com" && !userProfileData) { 
                        profile = { isAdmin: true, name: "Administrator", email: currentUserEmail, uid: currentUserId, createdAt: serverTimestamp() }; 
                        const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
                        await setDoc(userProfileDocRef, profile);
                        await loadAllDataForAdmin();
                        if (!globalSettings.setupComplete) {
                            openAdminSetupWizard();
                        } else {
                            enterPortal(true);
                        }
                    } else if (!userProfileData && currentUserEmail && currentUserEmail.toLowerCase() !== "admin@portal.com") { 
                        profile = { name: currentUserEmail.split('@')[0], email: currentUserEmail, uid: currentUserId, isAdmin: false, createdAt: serverTimestamp(), abn: "", gstRegistered: false, bsb: "", acc: "", files: [], authorizedServiceCodes: [], profileSetupComplete: false, nextInvoiceNumber: 1001 };
                        const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
                        await setDoc(userProfileDocRef, profile);
                        accounts[currentUserEmail] = { name: profile.name, profile: profile };
                        await loadAllDataForUser();
                        if (globalSettings.portalType === 'organization') {
                             openUserSetupWizard();
                        } else {
                            enterPortal(false); 
                        }
                    } else { 
                        console.warn("User logged in, but profile data is missing or role is unclear.");
                        await loadAllDataForUser(); 
                        enterPortal(false); 
                    }

                } else { 
                    currentUserId = null; currentUserEmail = null; profile = {}; accounts = {};
                    if($("#userIdDisplay")) $("#userIdDisplay").textContent = "Not Logged In";
                    if($("#logoutBtn")) $("#logoutBtn").classList.add('hide');
                    
                    if (authScreenElement) authScreenElement.style.display = "flex"; 
                    if (portalAppElement) portalAppElement.style.display = "none"; 
                    
                    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => { if (a.hash !== "#home") a.classList.add('hide'); });
                    if($("#adminTab")) $("#adminTab").classList.add('hide');
                    if($("#homeUser")) $("#homeUser").classList.add("hide");
                }
            } catch (error) { 
                console.error("Error in onAuthStateChanged logic:", error);
                showAuthStatusMessage("Authentication State Error: " + error.message);
                currentUserId = null; currentUserEmail = null; profile = {}; accounts = {}; 
                if (authScreenElement) authScreenElement.style.display = "flex"; 
                if (portalAppElement) portalAppElement.style.display = "none";
            } finally { 
                if (!initialAuthComplete) { initialAuthComplete = true; resolve(); }
                hideLoading();
            }
        });

        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            console.log("Attempting sign-in with custom token.");
            showLoading("Authenticating with token...");
            signInWithCustomToken(fbAuth, __initial_auth_token)
                .catch((error) => {
                    console.error("Custom token sign-in error:", error);
                    showAuthStatusMessage("Token Sign-In Error: " + error.message);
                    if (!initialAuthComplete) { initialAuthComplete = true; resolve(); } 
                    hideLoading(); 
                });
        } else if (fbAuth.currentUser) { 
            if (!initialAuthComplete) { initialAuthComplete = true; resolve(); }
        } else { 
            console.log("No initial token or active session. Displaying auth screen.");
            if (authScreenElement) authScreenElement.style.display = "flex";
            if (portalAppElement) portalAppElement.style.display = "none";
            if (!initialAuthComplete) { initialAuthComplete = true; resolve(); }
            hideLoading(); 
        }
    });
}

async function loadUserProfileFromFirestore(userIdToLoad) {
    if (!isFirebaseInitialized || !userIdToLoad) return null;
    try {
        const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${userIdToLoad}/profile`, "details");
        const docSnap = await getDoc(userProfileDocRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error("Error loading user profile from Firestore:", error);
        showMessage("Data Error", "Could not load user profile.");
        return null;
    }
}

async function loadAllDataForUser() {
    if (!isFirebaseInitialized) return;
    await Promise.all([ loadAdminServicesFromFirestore(), loadAgreementCustomizationsFromFirestore() ]);
}
async function loadAllDataForAdmin() {
    if (!isFirebaseInitialized) return;
    await Promise.all([ loadAdminServicesFromFirestore(), loadAgreementCustomizationsFromFirestore(), loadAllUserAccountsForAdminFromFirestore() ]);
}

async function getDefaultGlobalSettingsFirestore() { 
    return {
        setupComplete: false, portalType: "organization", organizationName: "NDIS Support Portal", 
        organizationAbn: "", organizationContactEmail: "", organizationContactPhone: "", adminUserName: "",
        participantName: "Participant Name", participantNdisNo: "000 000 000", 
        planManagerName: "Plan Manager Name", planManagerEmail: "manager@example.com", planManagerPhone: "0400 000 000",
        planEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], 
        agreementStartDate: new Date().toISOString().split('T')[0], 
        rateMultipliers: { weekday: 1.00, evening: 1.10, night: 1.14, saturday: 1.41, sunday: 1.81, public: 2.22 },
        lastUpdated: serverTimestamp() 
    };
}
async function loadGlobalSettingsFromFirestore() { 
    if (!isFirebaseInitialized) { globalSettings = await getDefaultGlobalSettingsFirestore(); return; }
    try {
        const settingsDocRef = doc(fsDb, `artifacts/${appId}/public/data/settings`, "global");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
            globalSettings = docSnap.data();
        } else {
            console.log("Global settings not found, creating default.");
            globalSettings = await getDefaultGlobalSettingsFirestore();
            await setDoc(settingsDocRef, globalSettings); 
        }
    } catch (e) {
        console.error("Error loading global settings from Firestore:", e);
        globalSettings = await getDefaultGlobalSettingsFirestore(); 
        showMessage("Data Error", "Could not load portal settings.");
    }
}
async function saveGlobalSettingsToFirestore() { 
    if (!isFirebaseInitialized || !(profile && profile.isAdmin)) return; 
    try {
        const settingsDocRef = doc(fsDb, `artifacts/${appId}/public/data/settings`, "global");
        const settingsToSave = { ...globalSettings, lastUpdated: serverTimestamp() };
        await setDoc(settingsDocRef, settingsToSave, { merge: true }); 
    } catch (e) { 
        console.error("Could not save global settings to Firestore:", e); 
        showMessage("Storage Error", "Could not save portal settings."); 
    } 
}

async function loadAdminServicesFromFirestore() {
    if (!isFirebaseInitialized) { adminManagedServices = []; return; }
    try {
        const servicesCollectionRef = collection(fsDb, `artifacts/${appId}/public/data/services`);
        const querySnapshot = await getDocs(servicesCollectionRef);
        adminManagedServices = [];
        querySnapshot.forEach((docSnap) => {
            adminManagedServices.push({ id: docSnap.id, ...docSnap.data() });
        });
        adminManagedServices.forEach(s => { if (!s.rates || typeof s.rates !== 'object') s.rates = {}; });
    } catch (e) {
        console.error("Error loading admin services from Firestore:", e);
        adminManagedServices = []; 
        showMessage("Data Error", "Could not load NDIS services.");
    }
}
async function saveAdminServiceToFirestore(servicePayload, serviceIdToUpdate = null) {
    if (!isFirebaseInitialized || !(profile && profile.isAdmin)) return false;
    try {
        const servicesCollectionRef = collection(fsDb, `artifacts/${appId}/public/data/services`);
        let serviceDocRef;

        if (serviceIdToUpdate) { 
            serviceDocRef = doc(fsDb, `artifacts/${appId}/public/data/services`, serviceIdToUpdate);
        } else { 
            const q = query(servicesCollectionRef, where("code", "==", servicePayload.code));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                showMessage("Validation Error", `Service code '${servicePayload.code}' already exists.`);
                if ($("#adminServiceCode")) $("#adminServiceCode").focus();
                return false;
            }
            serviceDocRef = doc(servicesCollectionRef); 
        }
        
        const payloadWithTimestamp = { ...servicePayload, id: serviceDocRef.id, lastUpdated: serverTimestamp() };
        await setDoc(serviceDocRef, payloadWithTimestamp); 
        
        const existingIndex = adminManagedServices.findIndex(s => s.id === serviceDocRef.id);
        if (existingIndex > -1) {
            adminManagedServices[existingIndex] = payloadWithTimestamp;
        } else {
            adminManagedServices.push(payloadWithTimestamp);
        }
        return true;
    } catch (e) {
        console.error("Error saving service to Firestore:", e);
        showMessage("Storage Error", "Could not save service.");
        return false;
    }
}
async function deleteAdminServiceFromFirestore(serviceId) {
    if (!isFirebaseInitialized || !(profile && profile.isAdmin)) return false;
    try {
        const serviceDocRef = doc(fsDb, `artifacts/${appId}/public/data/services`, serviceId);
        await deleteDoc(serviceDocRef);
        adminManagedServices = adminManagedServices.filter(s => s.id !== serviceId);
        return true;
    } catch (e) {
        console.error("Error deleting service from Firestore:", e);
        showMessage("Storage Error", "Could not delete service.");
        return false;
    }
}

async function loadAgreementCustomizationsFromFirestore() {
    if (!isFirebaseInitialized) { return; }
    try {
        const agreementDocRef = doc(fsDb, `artifacts/${appId}/public/data/agreementTemplates`, "main");
        const docSnap = await getDoc(agreementDocRef);
        if (docSnap.exists()) {
            const loadedData = docSnap.data();
            if (!agreementCustomData) agreementCustomData = {}; 
            agreementCustomData.overallTitle = loadedData.overallTitle || "NDIS Service Agreement"; 
            if (loadedData.clauses && Array.isArray(loadedData.clauses) && loadedData.clauses.length > 0) {
                agreementCustomData.clauses = loadedData.clauses;
            } else if (!agreementCustomData.clauses) { 
                 agreementCustomData.clauses = [{ heading: "Default Clause", body: "Details to be confirmed."}];
            }
        }  else if (!agreementCustomData) { 
             agreementCustomData = { 
                overallTitle: "NDIS Service Agreement (Default)",
                clauses: [{ heading: "Service Details", body: "To be agreed upon." }]
            };
            await setDoc(agreementDocRef, agreementCustomData);
        }
    } catch (e) {
        console.error("Error loading agreement customizations from Firestore:", e);
        showMessage("Data Error", "Could not load agreement template.");
        if (!agreementCustomData) {
            agreementCustomData = {
                overallTitle: "NDIS Service Agreement (Error Fallback)",
                clauses: [{ heading: "Error", body: "Could not load agreement clauses from server." }]
            };
        }
    }
}
async function saveAdminAgreementCustomizationsToFirestore(){
    if (!isFirebaseInitialized || !(profile && profile.isAdmin)) return;
    
    const overallTitleInput = $("#adminAgreementOverallTitle");
    if (typeof agreementCustomData !== 'object' || agreementCustomData === null) {
        agreementCustomData = {}; 
    }
    agreementCustomData.overallTitle = overallTitleInput ? overallTitleInput.value.trim() : "NDIS Service Agreement";
    
    const clausesContainer = $("#adminAgreementClausesContainer");
    const newClauses = [];
    if (clausesContainer) {
        clausesContainer.querySelectorAll('.agreement-clause-editor').forEach(clauseDiv => {
            const headingInput = clauseDiv.querySelector('.clause-heading-input');
            const bodyTextarea = clauseDiv.querySelector('.clause-body-textarea');
            const heading = headingInput ? headingInput.value.trim() : "";
            const body = bodyTextarea ? bodyTextarea.value.trim() : "";
            if (heading || body) newClauses.push({ heading, body });
        });
    }
    agreementCustomData.clauses = newClauses.length > 0 ? newClauses : (agreementCustomData.clauses || []); 
    const dataToSave = { ...agreementCustomData, lastUpdated: serverTimestamp() };

    try {
        const agreementDocRef = doc(fsDb, `artifacts/${appId}/public/data/agreementTemplates`, "main");
        await setDoc(agreementDocRef, dataToSave);
        showMessage("Success","Agreement structure saved.");
        renderAdminAgreementPreview(); 
    } catch (e) {
        console.error("Error saving agreement customizations to Firestore:", e);
        showMessage("Storage Error", "Could not save agreement structure.");
    }
}

window.modalLogin = async function () {
  const emailInput = $("#authEmail");
  const passwordInput = $("#authPassword");
  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value.trim() : "";

  showAuthStatusMessage("", false); 

  if (!email || !validateEmail(email) || !password || password.length < 6) { 
      return showAuthStatusMessage("Valid email and a password of at least 6 characters are required."); 
  }
  if (!isFirebaseInitialized || !fbAuth) {
      return showAuthStatusMessage("System Error: Authentication service not ready. Please refresh.");
  }

  try {
    showLoading("Signing in...");
    await signInWithEmailAndPassword(fbAuth, email, password);
  } catch (err) { 
      console.error("Login Failed:", err); 
      showAuthStatusMessage(err.message || "Invalid credentials or network issue."); 
  } finally { 
      hideLoading(); 
  }
};

window.modalRegister = async function () {
  const emailInput = $("#authEmail");
  const passwordInput = $("#authPassword");
  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value.trim() : "";

  showAuthStatusMessage("", false); 

  if (!email || !validateEmail(email) || !password || password.length < 6) { 
      return showAuthStatusMessage("Valid email and a password of at least 6 characters are required for registration."); 
  }
  if (!isFirebaseInitialized || !fbAuth || !fsDb) { 
      return showAuthStatusMessage("System Error: Registration service not ready. Please refresh.");
  }
  
  try {
    showLoading("Registering...");
    await createUserWithEmailAndPassword(fbAuth, email, password);
  } catch (err) { 
      console.error("Registration Failed:", err); 
      showAuthStatusMessage(err.message || "Could not create account. Email might be in use or network issue."); 
  } finally { 
      hideLoading(); 
  }
};

window.editProfile = function() {
    if (!currentUserId || !profile) {
        showMessage("Error", "User not logged in or profile not loaded.");
        return;
    }
    openUserSetupWizard(true); 
};

window.uploadProfileDocuments = async function() {
    if (!currentUserId || !fsDb) {
        showMessage("Error", "User not logged in or database not ready.");
        return;
    }
    const fileInput = $("#profileFileUpload");
    if (!fileInput || fileInput.files.length === 0) {
        showMessage("No Files", "Please select one or more files to upload.");
        return;
    }

    showLoading("Uploading documents...");
    // --- Placeholder for Firebase Storage upload ---
    console.warn("Firebase Storage upload logic needs to be implemented here.");
    const filesToUpload = Array.from(fileInput.files);
    const newFileEntries = [];

    for (const file of filesToUpload) {
        const uniqueFileName = `${Date.now()}-${file.name}`; 
        newFileEntries.push({
            name: file.name,
            storagePath: `artifacts/${appId}/users/${currentUserId}/documents/${uniqueFileName}`, 
            uploadedAt: serverTimestamp()
            // url: downloadURL, // This would come from Firebase Storage after successful upload
        });
    }

    if (newFileEntries.length > 0) {
        try {
            const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
            await updateDoc(userProfileDocRef, {
                files: arrayUnion(...newFileEntries) 
            });
            profile.files = [...(profile.files || []), ...newFileEntries.map(f => ({...f, uploadedAt: new Date()}))]; 
            loadProfileData(); 
            showMessage("Documents Updated", "File metadata added. Full upload requires Storage setup.");
        } catch (error) {
            console.error("Error updating profile with file metadata:", error);
            showMessage("Error", "Could not update profile with file information: " + error.message);
        }
    }
    fileInput.value = ""; 
    hideLoading();
};

window.addInvRowUserAction = function() { 
    addInvoiceRow(); 
    showMessage("Row Added", "A new row has been added to the invoice. Please fill in the details.");
};

window.saveDraft = async function() {
    if (!currentUserId || !fsDb) {
        showMessage("Error", "Cannot save draft. User not logged in or database not ready.");
        return;
    }
    showLoading("Saving invoice draft...");

    currentInvoiceData.invoiceNumber = $("#invNo")?.value || "";
    currentInvoiceData.invoiceDate = $("#invDate")?.value || new Date().toISOString().split('T')[0];
    currentInvoiceData.providerName = $("#provName")?.value || "";
    currentInvoiceData.providerAbn = $("#provAbn")?.value || "";
    currentInvoiceData.gstRegistered = ($("#gstFlag")?.value.toLowerCase() === 'yes');
    
    currentInvoiceData.items = [];
    const rows = $$("#invTbl tbody tr");
    rows.forEach((row) => {
        const itemDateEl = row.querySelector(`input[id^="itemDate"]`);
        const itemDescEl = row.querySelector(`select[id^="itemDesc"]`); 
        const itemStartTimeEl = row.querySelector(`input[id^="itemStart"]`);
        const itemEndTimeEl = row.querySelector(`input[id^="itemEnd"]`);
        const itemTravelKmEl = row.querySelector(`input[id^="itemTravel"]`);
        const itemClaimTravelEl = row.querySelector(`input[id^="itemClaimTravel"]`);

        const serviceCode = itemDescEl ? itemDescEl.value : "";
        const service = adminManagedServices.find(s => s.code === serviceCode);

        currentInvoiceData.items.push({
            date: itemDateEl ? itemDateEl.value : "",
            serviceCode: serviceCode,
            description: service ? service.description : "N/A",
            startTime: itemStartTimeEl ? itemStartTimeEl.dataset.value24 : "",
            endTime: itemEndTimeEl ? itemEndTimeEl.dataset.value24 : "",
            hoursOrKm: parseFloat(row.cells[8].textContent) || 0, 
            total: parseFloat(row.cells[10].textContent.replace('$', '')) || 0, 
            travelKmInput: itemTravelKmEl ? parseFloat(itemTravelKmEl.value) || 0 : 0,
            claimTravel: itemClaimTravelEl ? itemClaimTravelEl.checked : false,
            rateType: determineRateType(itemDateEl?.value, itemStartTimeEl?.dataset.value24) 
        });
    });

    calculateInvoiceTotals(); 
    currentInvoiceData.subtotal = parseFloat($("#sub")?.textContent.replace('$', '')) || 0;
    currentInvoiceData.gst = parseFloat($("#gst")?.textContent.replace('$', '')) || 0;
    currentInvoiceData.grandTotal = parseFloat($("#grand")?.textContent.replace('$', '')) || 0;
    currentInvoiceData.lastUpdated = serverTimestamp();

    try {
        const draftDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, `draft-${currentInvoiceData.invoiceNumber || 'current'}`);
        await setDoc(draftDocRef, currentInvoiceData);
        showMessage("Draft Saved", `Invoice draft "${currentInvoiceData.invoiceNumber || 'current'}" has been saved.`);
    } catch (error) {
        console.error("Error saving invoice draft:", error);
        showMessage("Storage Error", "Could not save invoice draft: " + error.message);
    } finally {
        hideLoading();
    }
};

window.generateInvoicePdf = function() {
    if (!currentUserId || !profile) {
        showMessage("Error", "Cannot generate PDF. User data not loaded.");
        return;
    }
    if (!currentInvoiceData || !currentInvoiceData.items || currentInvoiceData.items.length === 0) {
        showMessage("Empty Invoice", "Cannot generate PDF for an empty invoice. Please add services.");
        return;
    }

    let pdfHtml = `
        <style>
            body { font-family: 'Inter', sans-serif; font-size: 10pt; }
            .pdf-invoice-container { padding: 20px; }
            .pdf-header { text-align: center; margin-bottom: 20px; } /* Reduced margin */
            .pdf-header h1 { margin: 0 0 5px 0; font-size: 22pt; color: #333; }
            .pdf-header p { margin: 3px 0; font-size: 9pt; color: #555; }
            .pdf-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; font-size: 9pt;}
            .pdf-details-grid div { margin-bottom: 3px; }
            .pdf-details-grid strong { font-weight: 600; }
            .pdf-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 8pt; page-break-inside: auto; }
            .pdf-table th, .pdf-table td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; word-break: break-word; }
            .pdf-table th { background-color: #f0f0f0; font-weight: 600; }
            .pdf-table tr { page-break-inside: avoid; } /* Avoid breaking rows */
            .pdf-table td.number { text-align: right; }
            .pdf-totals { float: right; width: 220px; margin-top: 15px; font-size: 10pt; page-break-inside: avoid; }
            .pdf-totals div { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .pdf-totals strong { font-weight: 600; }
        </style>
        <div class="pdf-invoice-container">
            <div class="pdf-header">
                <h1>Tax Invoice</h1>
                <p>${globalSettings.organizationName || profile.name}</p>
                <p>ABN: ${globalSettings.organizationAbn || profile.abn}</p>
                ${profile.gstRegistered ? '<p>GST Registered</p>' : ''}
            </div>

            <div class="pdf-details-grid">
                <div>
                    <strong>To:</strong> ${globalSettings.participantName || 'N/A'}<br>
                    NDIS No: ${globalSettings.participantNdisNo || 'N/A'}<br>
                    ${globalSettings.planManagerName ? `Plan Manager: ${globalSettings.planManagerName}<br>` : ''}
                    ${globalSettings.planManagerEmail ? `Email: ${globalSettings.planManagerEmail}<br>` : ''}
                </div>
                <div>
                    <strong>Invoice #:</strong> ${currentInvoiceData.invoiceNumber || 'N/A'}<br>
                    <strong>Date Issued:</strong> ${formatDateForInvoiceDisplay(currentInvoiceData.invoiceDate) || 'N/A'}<br>
                    <strong>Support Worker:</strong> ${profile.name || 'N/A'}                 
                </div>
            </div>

            <table class="pdf-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>NDIS Code</th>
                        <th>Description</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Rate Type</th>
                        <th class="number">Rate/Unit ($)</th>
                        <th class="number">Hours/Km</th>
                        <th class="number">Total ($)</th>
                    </tr>
                </thead>
                <tbody>`;

    currentInvoiceData.items.forEach(item => {
        const service = adminManagedServices.find(s => s.code === item.serviceCode);
        let rateForPdf = 0;
        let rateTypeForPdf = item.rateType || determineRateType(item.date, item.startTime);

        if (service) {
            if (service.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) {
                rateForPdf = service.rates?.perKmRate || 0;
                rateTypeForPdf = "Travel";
            } else if (service.categoryType === SERVICE_CATEGORY_TYPES.CORE_STANDARD || service.categoryType === SERVICE_CATEGORY_TYPES.CORE_HIGH_INTENSITY) {
                rateForPdf = service.rates?.[rateTypeForPdf] || service.rates?.weekday || 0;
            } else { 
                rateForPdf = service.rates?.standardRate || 0;
            }
        }

        pdfHtml += `
                    <tr>
                        <td>${formatDateForInvoiceDisplay(item.date)}</td>
                        <td>${item.serviceCode || 'N/A'}</td>
                        <td>${item.description || 'N/A'}</td>
                        <td>${formatTime12Hour(item.startTime) || 'N/A'}</td>
                        <td>${formatTime12Hour(item.endTime) || 'N/A'}</td>
                        <td>${rateTypeForPdf}</td>
                        <td class="number">${rateForPdf.toFixed(2)}</td>
                        <td class="number">${item.hoursOrKm.toFixed(2)}</td>
                        <td class="number">${item.total.toFixed(2)}</td>
                    </tr>`;
    });

    pdfHtml += `
                </tbody>
            </table>

            <div class="pdf-totals">
                <div><span>Subtotal:</span> <strong>$${currentInvoiceData.subtotal.toFixed(2)}</strong></div>`;
    if (currentInvoiceData.gstRegistered || profile.gstRegistered) { 
        pdfHtml += `<div><span>GST (10%):</span> <strong>$${currentInvoiceData.gst.toFixed(2)}</strong></div>`;
    }
    pdfHtml += `   <div><span>Total:</span> <strong>$${currentInvoiceData.grandTotal.toFixed(2)}</strong></div>
            </div>
        </div>`;
    
    const tempDiv = document.createElement("div");
    // Optionally hide the temporary div if it briefly flashes on screen
    // tempDiv.style.position = "absolute";
    // tempDiv.style.left = "-9999px"; 
    tempDiv.innerHTML = pdfHtml;
    document.body.appendChild(tempDiv);
    
    const opt = {
        margin:       [10, 10, 10, 10], 
        filename:     `Invoice-${currentInvoiceData.invoiceNumber || 'draft'}-${new Date().toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, scrollY: -window.scrollY }, 
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(tempDiv).set(opt).save().then(() => {
        showMessage("PDF Generated", "Invoice PDF has been downloaded.");
        tempDiv.remove(); 
    }).catch(err => {
        console.error("PDF Export Error", err);
        showMessage("PDF Error", "Could not generate PDF: " + err.message);
        tempDiv.remove();
    });
};


window.saveSig = async function() {
    if (!canvas || !ctx) {
        showMessage("Error", "Signature pad not ready.");
        closeModal('sigModal');
        return;
    }
    if (isCanvasBlank(canvas)) {
        showMessage("Signature Required", "Please draw your signature before saving.");
        return;
    }

    const signatureDataUrl = canvas.toDataURL('image/png');
    ctx.clearRect(0, 0, canvas.width, canvas.height); 

    if (!currentUserId || !fsDb) {
        showMessage("Error", "Cannot save signature. User or database not ready.");
        closeModal('sigModal');
        return;
    }
    showLoading("Saving signature...");

    let agreementDocPath;
    let workerProfileForAgreement;

    if (profile.isAdmin && currentAgreementWorkerEmail) {
        workerProfileForAgreement = accounts[currentAgreementWorkerEmail]?.profile;
        if (!workerProfileForAgreement) {
            hideLoading();
            showMessage("Error", "Selected worker profile not found for agreement.");
            closeModal('sigModal');
            return;
        }
        agreementDocPath = `artifacts/${appId}/users/${workerProfileForAgreement.uid}/agreements/main`;
    } else if (!profile.isAdmin && currentUserId) {
        workerProfileForAgreement = profile;
        agreementDocPath = `artifacts/${appId}/users/${currentUserId}/agreements/main`;
    } else {
        hideLoading();
        showMessage("Error", "Cannot determine whose agreement to update.");
        closeModal('sigModal');
        return;
    }
    
    const updateData = {};
    if (signingAs === 'worker') {
        updateData.workerSigUrl = signatureDataUrl;
        updateData.workerSignDate = serverTimestamp();
        updateData.workerSigned = true;
    } else if (signingAs === 'participant') {
        updateData.participantSigUrl = signatureDataUrl;
        updateData.participantSignDate = serverTimestamp();
        updateData.participantSigned = true;
    } else {
        hideLoading();
        showMessage("Error", "Invalid signing role.");
        closeModal('sigModal');
        return;
    }
    updateData.lastUpdated = serverTimestamp();

    try {
        const agreementInstanceRef = doc(fsDb, agreementDocPath);
        await setDoc(agreementInstanceRef, updateData, { merge: true });
        
        const currentAgreementInstance = await getDoc(agreementInstanceRef);
        if(currentAgreementInstance.exists()){
            const updatedInstance = currentAgreementInstance.data();
            if (signingAs === 'worker') {
                if($("#sigW")) $("#sigW").src = updatedInstance.workerSigUrl;
                if($("#dW")) $("#dW").textContent = formatDateForInvoiceDisplay(updatedInstance.workerSignDate.toDate());
            } else {
                if($("#sigP")) $("#sigP").src = updatedInstance.participantSigUrl;
                if($("#dP")) $("#dP").textContent = formatDateForInvoiceDisplay(updatedInstance.participantSignDate.toDate());
            }
        }
        
        loadServiceAgreement(); 
        showMessage("Signature Saved", "Your signature has been saved to the agreement.");
    } catch (error) {
        console.error("Error saving signature:", error);
        showMessage("Storage Error", "Could not save signature: " + error.message);
    } finally {
        hideLoading();
        closeModal('sigModal');
    }
};

function isCanvasBlank(cvs) {
  const blank = document.createElement('canvas');
  blank.width = cvs.width;
  blank.height = cvs.height;
  return cvs.toDataURL() === blank.toDataURL();
}


function openUserSetupWizard(isEditing = false) {
    const wizModal = $("#wiz");
    if (wizModal) {
        userWizStep = 1;
        
        const wHead = $("#wHead");
        if (wHead) wHead.textContent = isEditing ? "Edit Your Profile" : "Step 1: Basic Info";
        
        if ($("#wName") && profile && profile.name) $("#wName").value = profile.name;
        if ($("#wAbn") && profile && profile.abn) $("#wAbn").value = profile.abn;
        if ($("#wGst") && profile && profile.gstRegistered !== undefined) $("#wGst").checked = profile.gstRegistered;
        if ($("#wBsb") && profile && profile.bsb) $("#wBsb").value = profile.bsb;
        if ($("#wAcc") && profile && profile.acc) $("#wAcc").value = profile.acc;
        
        updateUserWizardView(); 

        wizModal.classList.remove('hide');
        wizModal.style.display = "flex";
        if (!isEditing) {
            showMessage("Welcome!", "Please complete your profile setup to continue.");
        }
    }
}

function updateUserWizardView() {
    $$("#wiz .wizard-step-content").forEach(el => el.classList.add('hide'));
    $$("#wiz .wizard-step-indicator").forEach(el => el.classList.remove('active'));

    const currentStepContent = $(`#wStep${userWizStep}`);
    const currentStepIndicator = $(`#wizStepIndicator${userWizStep}`);

    if (currentStepContent) currentStepContent.classList.remove('hide');
    if (currentStepIndicator) currentStepIndicator.classList.add('active');
}

window.wizNext = function() {
    if (userWizStep === 1) {
        const name = $("#wName")?.value.trim();
        const abn = $("#wAbn")?.value.trim();
        if (!name) { return showMessage("Validation Error", "Full name is required."); }
        if (globalSettings.portalType === 'organization' && abn && !isValidABN(abn)) { 
            return showMessage("Validation Error", "Please enter a valid 11-digit ABN."); 
        }
        if (globalSettings.portalType === 'organization' && !abn) { return showMessage("Validation Error", "ABN is required for organization workers."); }

    } else if (userWizStep === 2) {
        const bsb = $("#wBsb")?.value.trim();
        const acc = $("#wAcc")?.value.trim();
         if (globalSettings.portalType === 'organization') {
            if (bsb && !isValidBSB(bsb)) { return showMessage("Validation Error", "Please enter a valid 6-digit BSB.");}
            if (acc && !isValidAccountNumber(acc)) { return showMessage("Validation Error", "Please enter a valid account number (6-10 digits).");}
            if (!bsb) { return showMessage("Validation Error", "BSB is required for organization workers."); }
            if (!acc) { return showMessage("Validation Error", "Account number is required for organization workers."); }
        }
    }
    if (userWizStep < 4) { 
        userWizStep++;
        updateUserWizardView();
    }
};
window.wizPrev = function() {
    if (userWizStep > 1) {
        userWizStep--;
        updateUserWizardView();
    }
};
window.wizFinish = async function() {
    if (!currentUserId || !fsDb) {
        showMessage("Error", "Cannot save profile. User not logged in or database not ready.");
        return;
    }
    
    const nameValue = $("#wName")?.value.trim();
    const abnValue = $("#wAbn")?.value.trim();
    const bsbValue = $("#wBsb")?.value.trim();
    const accValue = $("#wAcc")?.value.trim();

    if (!nameValue) { return showMessage("Validation Error", "Full name is required to finish setup."); }
    
    if (globalSettings.portalType === 'organization') {
        if (!abnValue) { return showMessage("Validation Error", "ABN is required to finish setup."); }
        if (abnValue && !isValidABN(abnValue)) { return showMessage("Validation Error", "Invalid ABN format. Please enter an 11-digit ABN.");}
        
        if (!bsbValue) { return showMessage("Validation Error", "BSB is required to finish setup."); }
        if (bsbValue && !isValidBSB(bsbValue)) { return showMessage("Validation Error", "Invalid BSB format. Please enter a 6-digit BSB.");}
        
        if (!accValue) { return showMessage("Validation Error", "Account number is required to finish setup."); }
        if (accValue && !isValidAccountNumber(accValue)) { return showMessage("Validation Error", "Invalid Account Number format. Please enter 6-10 digits.");}
    }

    showLoading("Saving profile...");
    const profileUpdates = {
        name: nameValue,
        abn: abnValue || profile.abn || "", 
        gstRegistered: $("#wGst")?.checked || false,
        bsb: bsbValue || profile.bsb || "",
        acc: accValue || profile.acc || "",
        profileSetupComplete: true, 
        lastUpdated: serverTimestamp()
    };

    try {
        const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        await updateDoc(userProfileDocRef, profileUpdates);

        profile = { ...profile, ...profileUpdates };
        if (accounts[currentUserEmail]) {
            accounts[currentUserEmail].profile = profile;
        } else if (accounts[currentUserId]) {
            accounts[currentUserId].profile = profile;
        }
        
        hideLoading();
        closeModal('wiz');
        showMessage("Profile Updated", "Your profile details have been saved successfully.");
        enterPortal(profile.isAdmin); 
        if(location.hash === "#profile") loadProfileData(); 

    } catch (error) {
        hideLoading();
        console.error("Error saving profile from wizard:", error);
        showMessage("Storage Error", "Could not save your profile details: " + error.message);
    }
};

window.saveRequest = async function() {
    if (!currentUserId || !fsDb) {
        showMessage("Error", "Cannot save request. User not logged in or database not ready.");
        return;
    }

    const requestDate = $("#rqDate")?.value;
    const requestStartTime = $("#rqStart")?.dataset.value24; 
    const requestEndTime = $("#rqEnd")?.dataset.value24;
    const requestReason = $("#rqReason")?.value.trim();

    if (!requestDate || !requestStartTime || !requestEndTime) {
        return showMessage("Validation Error", "Please select a date, start time, and end time for the shift request.");
    }
    if (timeToMinutes(requestEndTime) <= timeToMinutes(requestStartTime)) {
        return showMessage("Validation Error", "End time must be after start time.");
    }

    showLoading("Submitting shift request...");
    const requestData = {
        userId: currentUserId,
        userName: profile.name || currentUserEmail,
        date: requestDate,
        startTime: requestStartTime,
        endTime: requestEndTime,
        reason: requestReason || "",
        status: "pending", 
        requestedAt: serverTimestamp()
    };

    try {
        const requestsCollectionRef = collection(fsDb, `artifacts/${appId}/public/data/shiftRequests`);
        const newRequestRef = await addDoc(requestsCollectionRef, requestData);
        
        hideLoading();
        closeModal('rqModal');
        showMessage("Request Submitted", "Your shift request has been submitted successfully.");
        if (location.hash === "#home") {
            loadShiftRequestsForUserDisplay();
        }
    } catch (error) {
        hideLoading();
        console.error("Error submitting shift request:", error);
        showMessage("Storage Error", "Could not submit your shift request: " + error.message);
    }
};

window.saveInitialInvoiceNumber = async function() {
    if (!currentUserId || !fsDb || !profile) {
        showMessage("Error", "User not logged in or profile not ready.");
        return;
    }
    const initialNumberInput = $("#initialInvoiceNumberInput");
    const initialNumber = parseInt(initialNumberInput?.value, 10);

    if (isNaN(initialNumber) || initialNumber <= 0) {
        return showMessage("Validation Error", "Please enter a valid positive starting invoice number.");
    }

    showLoading("Saving invoice number...");
    try {
        const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        await updateDoc(userProfileDocRef, {
            nextInvoiceNumber: initialNumber,
            lastUpdated: serverTimestamp()
        });
        profile.nextInvoiceNumber = initialNumber; 
        
        if (location.hash === "#invoice") {
            $("#invNo").value = formatInvoiceNumber(initialNumber); 
        }
        
        hideLoading();
        closeModal('setInitialInvoiceModal');
        showMessage("Invoice Number Set", `Starting invoice number set to ${initialNumber}.`);
    } catch (error) {
        hideLoading();
        console.error("Error saving initial invoice number:", error);
        showMessage("Storage Error", "Could not save starting invoice number: " + error.message);
    }
};

window.saveShiftFromModalToInvoice = function() {
    const shiftDate = $("#logShiftDate")?.value;
    const supportTypeCode = $("#logShiftSupportType")?.value;
    const startTime = $("#logShiftStartTime")?.dataset.value24;
    const endTime = $("#logShiftEndTime")?.dataset.value24;
    const claimTravel = $("#logShiftClaimTravelToggle")?.checked;
    const startKm = parseFloat($("#logShiftStartKm")?.value);
    const endKm = parseFloat($("#logShiftEndKm")?.value);

    if (!shiftDate || !supportTypeCode || !startTime || !endTime) {
        return showMessage("Validation Error", "Please fill in all required shift details (Date, Support Type, Start/End Times).");
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        return showMessage("Validation Error", "Shift end time must be after start time.");
    }

    const service = adminManagedServices.find(s => s.code === supportTypeCode);
    if (!service) {
        return showMessage("Error", "Selected support type not found.");
    }

    addInvoiceRow({
        date: shiftDate,
        serviceCode: supportTypeCode,
        startTime: startTime,
        endTime: endTime,
    });

    if (claimTravel) {
        const calculatedKm = parseFloat($("#logShiftCalculatedKm")?.textContent) || 0;
        if (calculatedKm <= 0) {
            showMessage("Travel Warning", "Calculated travel is 0 Km. Travel row not added. Please check odometer readings.");
        } else {
            const travelServiceCode = service.travelCode; 
            const travelService = adminManagedServices.find(s => s.code === travelServiceCode && s.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM);
            if (travelService) {
                addInvoiceRow({
                    date: shiftDate,
                    serviceCode: travelService.code,
                    travelKmInput: calculatedKm, 
                    claimTravel: true 
                });
            } else {
                showMessage("Travel Error", `Associated travel service code (${travelServiceCode || 'N/A'}) not found or not configured as 'Travel - Per Kilometre'. Travel not added.`);
            }
        }
    }
    
    calculateInvoiceTotals(); 
    closeModal('logShiftModal');
    showMessage("Shift Added", "Shift details have been added to the current invoice.");
};


// --- Admin Setup Wizard (#adminSetupWizard) Functions ---
function openAdminSetupWizard() { 
    const modal = $("#adminSetupWizard"); 
    if(modal) { 
        adminWizStep = 1; 
        const currentPortalType = globalSettings.portalType || 'organization';
        const portalTypeRadio = $(`input[name="adminWizPortalType"][value="${currentPortalType}"]`);
        if (portalTypeRadio) portalTypeRadio.checked = true;

        updateAdminWizardView(); 
        modal.style.display = "flex"; 
    } 
}

function updateAdminWizardView() {
    $$("#adminSetupWizard .wizard-step-content").forEach(el => el.classList.add('hide'));
    $$("#adminSetupWizard .wizard-step-indicator").forEach(el => el.classList.remove('active'));

    const currentStepContent = $(`#adminWizStep${adminWizStep}`);
    const currentStepIndicator = $(`#adminWizStepIndicator${adminWizStep}`);

    if (currentStepContent) currentStepContent.classList.remove('hide');
    if (currentStepIndicator) currentStepIndicator.classList.add('active');

    const adminWizHead = $("#adminWizHead");
    const adminWizStep2Title = $("#adminWizStep2Title");
    const adminWizStep3Title = $("#adminWizStep3Title");
    const adminWizOrgFields = $("#adminWizOrgFields");
    const adminWizUserFields = $("#adminWizUserFields");

    if (adminWizStep === 1) {
        if (adminWizHead) adminWizHead.innerHTML = `<i class="fas fa-magic"></i> Portal Setup - Step 1: Portal Type`;
        const portalType = globalSettings.portalType || 'organization';
        const portalTypeRadio = $(`input[name="adminWizPortalType"][value="${portalType}"]`);
        if (portalTypeRadio) portalTypeRadio.checked = true;

    } else if (adminWizStep === 2) {
        const portalType = document.querySelector('input[name="adminWizPortalType"]:checked')?.value || globalSettings.portalType || 'organization';
        if (adminWizHead) adminWizHead.innerHTML = `<i class="fas fa-magic"></i> Portal Setup - Step 2: Details`;
        if (portalType === 'organization') {
            if (adminWizStep2Title) adminWizStep2Title.textContent = "Step 2: Organization Details";
            if (adminWizOrgFields) adminWizOrgFields.classList.remove('hide');
            if (adminWizUserFields) adminWizUserFields.classList.add('hide');
            if ($("#adminWizOrgName")) $("#adminWizOrgName").value = globalSettings.organizationName || "";
            if ($("#adminWizOrgAbn")) $("#adminWizOrgAbn").value = globalSettings.organizationAbn || "";
            if ($("#adminWizOrgContactEmail")) $("#adminWizOrgContactEmail").value = globalSettings.organizationContactEmail || "";
            if ($("#adminWizOrgContactPhone")) $("#adminWizOrgContactPhone").value = globalSettings.organizationContactPhone || "";
        } else { 
            if (adminWizStep2Title) adminWizStep2Title.textContent = "Step 2: Your Details";
            if (adminWizOrgFields) adminWizOrgFields.classList.add('hide');
            if (adminWizUserFields) adminWizUserFields.classList.remove('hide');
            if ($("#adminWizUserName")) $("#adminWizUserName").value = globalSettings.adminUserName || profile.name || ""; 
        }
    } else if (adminWizStep === 3) {
        if (adminWizHead) adminWizHead.innerHTML = `<i class="fas fa-magic"></i> Portal Setup - Step 3: Participant Details`;
        const portalType = document.querySelector('input[name="adminWizPortalType"]:checked')?.value || globalSettings.portalType || 'organization';
        if (adminWizStep3Title) adminWizStep3Title.textContent = portalType === 'organization' ? "Step 3: Default Participant Details" : "Step 3: Your (Participant) Plan Details";
        
        if ($("#adminWizParticipantName")) $("#adminWizParticipantName").value = globalSettings.participantName || "";
        if ($("#adminWizParticipantNdisNo")) $("#adminWizParticipantNdisNo").value = globalSettings.participantNdisNo || "";
        if ($("#adminWizPlanManagerName")) $("#adminWizPlanManagerName").value = globalSettings.planManagerName || "";
        if ($("#adminWizPlanManagerEmail")) $("#adminWizPlanManagerEmail").value = globalSettings.planManagerEmail || "";
        if ($("#adminWizPlanManagerPhone")) $("#adminWizPlanManagerPhone").value = globalSettings.planManagerPhone || "";
        if ($("#adminWizPlanEndDate")) $("#adminWizPlanEndDate").value = globalSettings.planEndDate || "";
    }
}

window.adminWizNext = function() {
    if (adminWizStep === 1) {
        updateAdminWizardView(); 
    } else if (adminWizStep === 2) {
        const portalType = document.querySelector('input[name="adminWizPortalType"]:checked')?.value;
        if (portalType === 'organization') {
            const orgName = $("#adminWizOrgName")?.value.trim();
            const orgAbn = $("#adminWizOrgAbn")?.value.trim();
            if (!orgName) { return showMessage("Validation Error", "Organization Name is required for 'Organization' type.");}
            if (orgAbn && !isValidABN(orgAbn)) { return showMessage("Validation Error", "Invalid ABN. Please enter an 11-digit ABN.");}
        } else { 
            if (!$("#adminWizUserName")?.value.trim()) {
                return showMessage("Validation Error", "Your Name is required for 'Self-Managed Participant' type.");
            }
        }
    }

    if (adminWizStep < 3) { 
        adminWizStep++;
        updateAdminWizardView();
    } else {
        console.log("Already on the last step of admin wizard.");
    }
};

window.adminWizPrev = function() {
    if (adminWizStep > 1) {
        adminWizStep--;
        updateAdminWizardView();
    }
};

window.adminWizFinish = async function() {
    if (!isFirebaseInitialized || !(profile && profile.isAdmin)) {
        showMessage("Error", "Permission denied or system not ready.");
        return;
    }
    
    const portalTypeSelected = document.querySelector('input[name="adminWizPortalType"]:checked')?.value;
    if (!portalTypeSelected) {
        showMessage("Validation Error", "Please select a Portal Type in Step 1.");
        adminWizStep = 1; 
        updateAdminWizardView();
        return;
    }

    let tempGlobalSettings = {
        portalType: portalTypeSelected,
        participantName: $("#adminWizParticipantName")?.value.trim() || "Default Participant",
        participantNdisNo: $("#adminWizParticipantNdisNo")?.value.trim() || "",
        planManagerName: $("#adminWizPlanManagerName")?.value.trim() || "",
        planManagerEmail: $("#adminWizPlanManagerEmail")?.value.trim() || "",
        planManagerPhone: $("#adminWizPlanManagerPhone")?.value.trim() || "",
        planEndDate: $("#adminWizPlanEndDate")?.value || "",
        setupComplete: true,
        lastUpdated: serverTimestamp(),
        rateMultipliers: globalSettings.rateMultipliers || { weekday: 1.00, evening: 1.10, night: 1.14, saturday: 1.41, sunday: 1.81, public: 2.22 },
        agreementStartDate: globalSettings.agreementStartDate || new Date().toISOString().split('T')[0]
    };

    if (portalTypeSelected === 'organization') {
        tempGlobalSettings.organizationName = $("#adminWizOrgName")?.value.trim();
        tempGlobalSettings.organizationAbn = $("#adminWizOrgAbn")?.value.trim() || "";
        tempGlobalSettings.organizationContactEmail = $("#adminWizOrgContactEmail")?.value.trim() || "";
        tempGlobalSettings.organizationContactPhone = $("#adminWizOrgContactPhone")?.value.trim() || "";
        tempGlobalSettings.adminUserName = profile.name; 

        if (!tempGlobalSettings.organizationName) {
            showMessage("Validation Error", "Organization Name is required for 'Organization' type (Step 2).");
            adminWizStep = 2; updateAdminWizardView(); return;
        }
        if (tempGlobalSettings.organizationAbn && !isValidABN(tempGlobalSettings.organizationAbn)) {
            showMessage("Validation Error", "Invalid ABN. Please enter an 11-digit ABN for the organization (Step 2).");
            adminWizStep = 2; updateAdminWizardView(); return;
        }
        if (tempGlobalSettings.organizationContactEmail && !validateEmail(tempGlobalSettings.organizationContactEmail)) {
            showMessage("Validation Error", "Invalid Organization Contact Email format (Step 2).");
            adminWizStep = 2; updateAdminWizardView(); return;
        }

    } else { 
        tempGlobalSettings.adminUserName = $("#adminWizUserName")?.value.trim();
        tempGlobalSettings.organizationName = tempGlobalSettings.adminUserName || profile.name || "Participant Portal"; 
        
        if (!tempGlobalSettings.adminUserName) {
            showMessage("Validation Error", "Your Name is required for 'Self-Managed Participant' type (Step 2).");
            adminWizStep = 2; updateAdminWizardView(); return;
        }
        if (profile.uid === currentUserId && tempGlobalSettings.adminUserName !== profile.name) {
            const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
            try {
                await updateDoc(userProfileDocRef, { name: tempGlobalSettings.adminUserName });
                profile.name = tempGlobalSettings.adminUserName; 
            } catch (e) { console.error("Error updating admin's name during participant setup:", e); }
        }
        tempGlobalSettings.participantName = tempGlobalSettings.adminUserName; 
    }
    
    if (!tempGlobalSettings.participantName && portalTypeSelected === 'organization') { 
        showMessage("Validation Error", "Default Participant Name is required (Step 3).");
        adminWizStep = 3; updateAdminWizardView(); return;
    }
     if (!tempGlobalSettings.participantName && portalTypeSelected === 'participant') { 
        tempGlobalSettings.participantName = tempGlobalSettings.adminUserName;
    }
    if (tempGlobalSettings.planManagerEmail && !validateEmail(tempGlobalSettings.planManagerEmail)) {
        showMessage("Validation Error", "Invalid Plan Manager Email format (Step 3).");
        adminWizStep = 3; updateAdminWizardView(); return;
    }

    showLoading("Finalizing portal setup...");
    globalSettings = { ...globalSettings, ...tempGlobalSettings }; 

    try {
        await saveGlobalSettingsToFirestore(); 
        hideLoading();
        closeModal('adminSetupWizard');
        showMessage("Setup Complete", "Portal has been configured successfully.");
        enterPortal(true); 
        if(location.hash === "#admin") {
            loadAdminPortalSettings(); 
            setActive("#admin"); 
        }

    } catch (error) {
        hideLoading();
        console.error("Error finalizing admin setup:", error);
        showMessage("Storage Error", "Could not save portal configuration: " + error.message);
    }
};
// --- End Admin Setup Wizard Functions ---


window.copyLink = function(){ const inviteLinkElement = $("#invite"); const link = inviteLinkElement ? inviteLinkElement.textContent : null; if (link && navigator.clipboard) { navigator.clipboard.writeText(link).then(()=>showMessage("Copied","Invite link copied to clipboard!")).catch(err=>showMessage("Copy Error","Could not copy link: " + err)); } else if (link) { const textArea = document.createElement("textarea"); textArea.value = link; document.body.appendChild(textArea); textArea.focus(); textArea.select(); try { document.execCommand('copy'); showMessage("Copied","Invite link copied!"); } catch (err) { showMessage("Copy Error","Failed to copy link."); } document.body.removeChild(textArea); } else { showMessage("Error", "Invite link not found."); }};

async function loadAllUserAccountsForAdminFromFirestore() {
    if (!isFirebaseInitialized || !(profile && profile.isAdmin)) {
        console.warn("Admin data load skipped: Firebase not ready or user not admin.");
        return;
    }
    showLoading("Loading worker accounts...");
    try {
        const usersCollectionRef = collection(fsDb, `artifacts/${appId}/users`);
        const usersSnapshot = await getDocs(usersCollectionRef);
        
        accounts = {}; // Reset accounts
        const profilePromises = [];

        usersSnapshot.forEach((userDocSnapshot) => { // Renamed to avoid conflict
            const userId = userDocSnapshot.id;
            // Skip the admin user itself from being listed as a 'worker' to manage
            if (userId === currentUserId && profile.isAdmin) { 
                // Store admin's own profile if needed, but don't add to list of workers for auth
                if (profile.email) accounts[profile.email] = { name: profile.name, profile: profile };
                else accounts[userId] = { name: profile.name, profile: profile };
                return;
            }

            const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${userId}/profile`, "details");
            profilePromises.push(
                getDoc(userProfileDocRef).then(profileSnap => {
                    if (profileSnap.exists()) {
                        const userData = profileSnap.data();
                        // Ensure only non-admin users are added to the 'accounts' for worker management
                        if (!userData.isAdmin) { 
                            if (userData.email) {
                                accounts[userData.email] = { name: userData.name || 'Unnamed Worker', profile: { uid: userId, ...userData } };
                            } else {
                                // Fallback if email is somehow missing, though unlikely for registered users
                                accounts[userId] = { name: userData.name || 'Unnamed Worker', profile: { uid: userId, ...userData } };
                            }
                        } else if (userId === currentUserId) { // Store admin's own profile
                             if (userData.email) accounts[userData.email] = { name: userData.name, profile: { uid: userId, ...userData } };
                             else accounts[userId] = { name: userData.name, profile: { uid: userId, ...userData } };
                        }
                    } else {
                        console.warn(`Profile details not found for user ID: ${userId}`);
                    }
                }).catch(err => {
                    console.error(`Error fetching profile for user ID ${userId}:`, err);
                })
            );
        });
        await Promise.all(profilePromises); 
        console.log("Loaded accounts for admin:", accounts);

        if(location.hash === "#agreement" && $("#adminAgreementWorkerSelector")) populateAdminWorkerSelectorForAgreement();
        if(location.hash === "#admin" && $(".admin-tab-btn.active")?.dataset.target === "adminWorkerManagement") displayWorkersForAuth(); 
    
    } catch (error) { 
        console.error("Error loading user accounts for admin from Firestore:", error); 
        showMessage("Data Error", "Could not load worker accounts for admin: " + error.message); 
    } finally {
        hideLoading();
    }
}


function displayWorkersForAuth() {
    const ul = $("#workersListForAuth"); 
    if (!ul) {
        console.error("Element #workersListForAuth not found");
        return;
    }
    ul.innerHTML = ""; 
    
    // Filter out the admin user from the list of workers to be managed
    const workerAccounts = Object.entries(accounts).filter(([key, acc]) => {
        return acc && acc.profile && !acc.profile.isAdmin;
    });
    
    console.log("Displaying workers for auth:", workerAccounts);

    if (workerAccounts.length === 0) { 
        ul.innerHTML = "<li>No workers found to authorize.</li>"; 
        const selectedWorkerNameEl = $("#selectedWorkerNameForAuth");
        if (selectedWorkerNameEl) selectedWorkerNameEl.innerHTML = `<i class="fas fa-user-check"></i> Select a Worker`;
        const servicesContainerEl = $("#servicesForWorkerContainer");
        if (servicesContainerEl) servicesContainerEl.classList.add("hide");
        return; 
    }

    workerAccounts.forEach(([key, worker]) => { 
        const displayIdentifier = worker.profile.email || key; 
        const li = document.createElement("li"); 
        li.innerHTML = `<i class="fas fa-user-tie"></i> ${worker.profile.name || 'Unnamed Worker'} <small>(${displayIdentifier})</small>`; 
        li.dataset.key = key; // Use the key from accounts (email or UID)
        li.onclick = () => selectWorkerForAuth(key); 
        ul.appendChild(li); 
    });
}


function selectWorkerForAuth(key) { 
    selectedWorkerEmailForAuth = key; // This key is the email or UID used in the 'accounts' object
    const worker = accounts[selectedWorkerEmailForAuth]; 
    const nameEl = $("#selectedWorkerNameForAuth");
    const containerEl = $("#servicesForWorkerContainer");

    if (!worker || !worker.profile) { 
        showMessage("Error", "Selected worker data not found."); 
        if(nameEl) nameEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error loading worker`; 
        if(containerEl) containerEl.classList.add("hide"); 
        return; 
    }
    if(nameEl) nameEl.innerHTML = `<i class="fas fa-user-check"></i> Authorizing: <strong>${worker.profile.name || 'Unnamed Worker'}</strong>`; 
    if(containerEl) containerEl.classList.remove("hide");
    
    $$("#workersListForAuth li").forEach(li => li.classList.remove("selected-worker-auth")); 
    const selectedLi = $(`#workersListForAuth li[data-key="${key}"]`);
    if (selectedLi) selectedLi.classList.add("selected-worker-auth");
    
    displayServicesForWorkerAuth(worker.profile);
}

function displayServicesForWorkerAuth(workerProfileData) {
    const ul = $("#servicesListCheckboxes"); if (!ul) return; ul.innerHTML = ""; 
    const authorizedCodes = workerProfileData.authorizedServiceCodes || [];
    
    if (adminManagedServices.length === 0) { 
        ul.innerHTML = "<li>No NDIS services have been defined by the admin yet.</li>"; 
        return; 
    }
    
    let servicesAvailable = false;
    adminManagedServices.forEach(service => { 
        if (service.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM) { 
            servicesAvailable = true;
            const li = document.createElement("li");
            const label = document.createElement("label"); 
            label.className = "chk"; 
            const checkbox = document.createElement("input"); 
            checkbox.type = "checkbox"; 
            checkbox.value = service.code; 
            checkbox.checked = authorizedCodes.includes(service.code); 
            label.appendChild(checkbox); 
            label.appendChild(document.createTextNode(` ${service.description} (${service.code})`)); 
            li.appendChild(label); 
            ul.appendChild(li); 
        } 
    });
    if (!servicesAvailable) {
        ul.innerHTML = "<li>No suitable (non-travel) NDIS services defined for authorization.</li>";
    }
}

async function saveWorkerAuthorizationsToFirestore() {
    if (!isFirebaseInitialized || !selectedWorkerEmailForAuth || !accounts[selectedWorkerEmailForAuth]?.profile) { 
        showMessage("Error", "No worker selected or worker data is invalid. Cannot save authorizations."); 
        return; 
    }
    const workerUid = accounts[selectedWorkerEmailForAuth].profile.uid; 
    if (!workerUid) { 
        showMessage("Error", "Worker User ID not found. Cannot save authorizations."); 
        return; 
    }
    
    const selectedServiceCodes = []; 
    $$('#servicesListCheckboxes input[type="checkbox"]:checked').forEach(checkbox => selectedServiceCodes.push(checkbox.value));
    
    showLoading("Saving authorizations...");
    try {
        const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${workerUid}/profile`, "details");
        await updateDoc(userProfileDocRef, {
            authorizedServiceCodes: selectedServiceCodes,
            lastUpdated: serverTimestamp()
        }); 
        
        accounts[selectedWorkerEmailForAuth].profile.authorizedServiceCodes = selectedServiceCodes;
        if (currentUserId === workerUid && !profile.isAdmin) { 
            profile.authorizedServiceCodes = selectedServiceCodes;
        }
        hideLoading(); 
        showMessage("Success", `Authorizations for ${accounts[selectedWorkerEmailForAuth].profile.name || 'Worker'} saved successfully.`);
    } catch (e) { 
        hideLoading(); 
        console.error("Error saving worker authorizations to Firestore:", e); 
        showMessage("Storage Error", "Could not save worker authorizations: " + e.message); 
    }
}

function setActive(hash) {
  if (!currentUserId || (portalAppElement && portalAppElement.style.display === 'none')) {
      if (authScreenElement && authScreenElement.style.display !== 'flex') {
          if (portalAppElement) portalAppElement.style.display = 'none';
          authScreenElement.style.display = 'flex';
      }
      return;
  }

  const currentHash = hash || location.hash || (profile && profile.isAdmin ? "#admin" : "#home"); 
  $$("nav#side a.link, nav#bottom a.bLink").forEach(a => a.classList.toggle("active", a.hash === currentHash));
  $$("main section.card").forEach(s => s.classList.toggle("active", `#${s.id}` === currentHash));
  window.scrollTo(0, 0); 
  
  const portalTitleElement = $("#portalTitleDisplay");
  if (portalTitleElement) {
      if (globalSettings?.organizationName && globalSettings.portalType === 'organization') {
          portalTitleElement.innerHTML = `<i class="fas fa-cogs"></i> ${globalSettings.organizationName}`;
      } else if (globalSettings?.portalType === 'participant' && globalSettings?.participantName) {
          portalTitleElement.innerHTML = `<i class="fas fa-cogs"></i> ${globalSettings.organizationName || globalSettings.participantName}'s Portal`;
      } else if (profile && profile.isAdmin && globalSettings?.organizationName) { 
          portalTitleElement.innerHTML = `<i class="fas fa-cogs"></i> ${globalSettings.organizationName}`;
      }
      else {
          portalTitleElement.innerHTML = `<i class="fas fa-cogs"></i> NDIS Portal`;
      }
  }

  $$("nav#side a.link, nav#bottom a.bLink").forEach(a => {
      if (a.hash === "#home") {
          a.classList.remove('hide'); 
      } else if (a.hash === "#admin") {
          if (profile && profile.isAdmin) a.classList.remove('hide');
          else a.classList.add('hide');
      } else { 
          if (currentUserId && !(profile && profile.isAdmin)) a.classList.remove('hide'); 
          else if (profile && profile.isAdmin) a.classList.add('hide'); 
          else a.classList.add('hide'); 
      }
  });
  const adminSideNavLink = $("nav#side a.link#adminTab");
  if(adminSideNavLink){
      if (profile && profile.isAdmin) adminSideNavLink.classList.remove('hide');
      else adminSideNavLink.classList.add('hide');
  }

  if (currentHash === "#invoice" && !(profile && profile.isAdmin)) handleInvoicePageLoad();
  else if (currentHash === "#profile" && !(profile && profile.isAdmin)) loadProfileData();
  else if (currentHash === "#agreement") { 
      const adminSelector = $("#adminAgreementWorkerSelector");
      const agreementContainer = $("#agreementContentContainer");
      const agrChipEl = $("#agrChip");
      const signBtnEl = $("#signBtn"); 
      const participantSignBtnEl = $("#participantSignBtn");
      const pdfBtnEl = $("#pdfBtn");

      if (profile?.isAdmin && adminSelector) { 
          adminSelector.classList.remove('hide'); 
          populateAdminWorkerSelectorForAgreement();
          if (agreementContainer) agreementContainer.innerHTML = "<p><em>Select a worker from the dropdown above to view or manage their service agreement.</em></p>";
          if (agrChipEl) { agrChipEl.className = "chip yellow"; agrChipEl.textContent = "Select Worker"; }
          if (signBtnEl) signBtnEl.classList.add("hide"); 
          if (participantSignBtnEl) participantSignBtnEl.classList.add("hide"); 
          if (pdfBtnEl) pdfBtnEl.classList.add("hide"); 
      } else if (currentUserId && !(profile?.isAdmin)) { 
          if (adminSelector) adminSelector.classList.add('hide');
          currentAgreementWorkerEmail = currentUserEmail; 
          loadServiceAgreement(); 
      } else { 
          if (agreementContainer) agreementContainer.innerHTML = "<p><em>Please log in to view service agreements.</em></p>"; 
      }
  } else if (currentHash === "#admin" && profile?.isAdmin) { 
    loadAdminPortalSettings(); 
    loadAdminAgreementCustomizations(); 
    renderAdminServicesTable(); 
    
    $$('.admin-tab-btn').forEach(btn => { 
        btn.removeEventListener('click', handleAdminTabClick); 
        btn.addEventListener('click', handleAdminTabClick); 
    });
    
    let activeAdminTab = $('.admin-tab-btn.active');
    let targetAdminPanelId;
    if (!activeAdminTab && $$('.admin-tab-btn').length > 0) {
        $$('.admin-tab-btn')[0].click(); 
    } else if (activeAdminTab) {
        targetAdminPanelId = activeAdminTab.dataset.target;
        $$('.admin-content-panel').forEach(p => p.classList.remove('active')); 
        const targetPanel = $(`#${targetAdminPanelId}`);
        if (targetPanel) targetPanel.classList.add('active');

        if (targetAdminPanelId === "adminServiceManagement") {
            const categoryTypeSelect = $("#adminServiceCategoryType");
            if (categoryTypeSelect) updateRateFieldsVisibility(categoryTypeSelect.value);
        }
        if (targetAdminPanelId === "adminWorkerManagement") displayWorkersForAuth(); 
    }
  } else if (currentHash === "#home") {
      handleHomePageDisplay();
  }
}

function handleAdminTabClick(event) {
    const clickedButton = event.currentTarget; 
    $$('.admin-tab-btn').forEach(b => b.classList.remove('active')); 
    clickedButton.classList.add('active');
    
    $$('.admin-content-panel').forEach(p => p.classList.remove('active')); 
    const targetPanelId = clickedButton.dataset.target;
    const targetPanelElement = $(`#${targetPanelId}`);
    if (targetPanelElement) targetPanelElement.classList.add('active');
    
    if (targetPanelId === "adminServiceManagement") {
        const categoryTypeSelect = $("#adminServiceCategoryType");
        if (categoryTypeSelect) updateRateFieldsVisibility(categoryTypeSelect.value);
    } else if (targetPanelId === "adminWorkerManagement") {
        displayWorkersForAuth(); 
    }
}

function clearAdminServiceForm() { 
    const serviceIdInput = $("#adminServiceId"); if(serviceIdInput) serviceIdInput.value = "";
    const serviceCodeInput = $("#adminServiceCode"); if(serviceCodeInput) serviceCodeInput.value = "";
    const serviceDescInput = $("#adminServiceDescription"); if(serviceDescInput) serviceDescInput.value = "";
    const categoryTypeSelect = $("#adminServiceCategoryType"); 
    if(categoryTypeSelect) { 
        categoryTypeSelect.value = SERVICE_CATEGORY_TYPES.CORE_STANDARD; 
        updateRateFieldsVisibility(SERVICE_CATEGORY_TYPES.CORE_STANDARD); 
    }
    const travelCodeInput = $("#adminServiceTravelCode"); if(travelCodeInput) travelCodeInput.value = "";
    const travelCodeDisplay = $("#adminServiceTravelCodeDisplay"); if(travelCodeDisplay) travelCodeDisplay.value = "None selected";
    
    const formHeader = $("#adminServiceFormContainer h4"); 
    if(formHeader) formHeader.innerHTML = `<i class="fas fa-plus-square"></i> Add Service`;
}

document.addEventListener('DOMContentLoaded', async () => {
    showLoading("Initializing Portal..."); 
    
    await initializeFirebase(); 

    if (!isFirebaseInitialized) {
        hideLoading(); 
        console.log("[App] Firebase not initialized. Halting further DOM-dependent setup.");
        return; 
    }
    
    const addClauseBtn = $("#adminAddAgreementClauseBtn");
    if (addClauseBtn) addClauseBtn.addEventListener('click', handleAddAgreementClause);

    const serviceCategoryTypeSelect = $("#adminServiceCategoryType");
    if (serviceCategoryTypeSelect) serviceCategoryTypeSelect.addEventListener('change', (e) => updateRateFieldsVisibility(e.target.value));
    
    const selectTravelCodeBtnEl = $("#selectTravelCodeBtn");
    if (selectTravelCodeBtnEl) selectTravelCodeBtnEl.addEventListener('click', () => { 
        const currentServiceCodeBeingEdited = $("#adminServiceCode")?.value;
        const travelCodeListContainerEl = $("#travelCodeListContainer"); 
        if (!travelCodeListContainerEl) return; 
        travelCodeListContainerEl.innerHTML = ""; 
        
        const travelServices = adminManagedServices.filter(s => s.code !== currentServiceCodeBeingEdited && s.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM); 
        
        if (travelServices.length === 0) {
            travelCodeListContainerEl.innerHTML = "<p>No 'Travel - Per KM' type services have been defined yet, or you are editing the only travel service.</p>";
        } else { 
            const ul = document.createElement('ul'); 
            ul.className = 'modal-selectable-list'; 
            travelServices.forEach(s => { 
                const li = document.createElement('li'); 
                li.textContent = `${s.description} (${s.code})`; 
                li.dataset.code = s.code; 
                li.dataset.description = s.description; 
                li.onclick = () => { 
                    $$('#travelCodeListContainer li').forEach(item => item.classList.remove('selected')); 
                    li.classList.add('selected'); 
                }; 
                ul.appendChild(li); 
            }); 
            travelCodeListContainerEl.appendChild(ul); 
        } 
        const travelCodeFilterInputEl = $("#travelCodeFilterInput");
        if (travelCodeFilterInputEl) travelCodeFilterInputEl.value = ""; 
        filterTravelCodeList(); 
        
        const travelModal = $("#travelCodeSelectionModal"); 
        if(travelModal) { 
            travelModal.classList.remove('hide'); 
            travelModal.style.display = "flex"; 
        }
    });

    const travelCodeFilterInputEl = $("#travelCodeFilterInput");
    if (travelCodeFilterInputEl) travelCodeFilterInputEl.addEventListener('input', filterTravelCodeList);

    const confirmTravelCodeBtn = $("#confirmTravelCodeSelectionBtn");
    if (confirmTravelCodeBtn) confirmTravelCodeBtn.addEventListener('click', () => { 
        const selectedLi = $("#travelCodeListContainer li.selected"); 
        if (selectedLi) { 
            const code = selectedLi.dataset.code;
            const desc = selectedLi.dataset.description;
            const travelCodeHiddenInput = $("#adminServiceTravelCode");
            if (travelCodeHiddenInput) travelCodeHiddenInput.value = code;
            const travelCodeDisplayInput = $("#adminServiceTravelCodeDisplay");
            if (travelCodeDisplayInput) travelCodeDisplayInput.value = `${desc} (${code})`;
            closeModal('travelCodeSelectionModal'); 
        } else { 
            showMessage("Selection Error", "Please select a travel code from the list or cancel."); 
        } 
    });

    const timePickerBackBtn = $("#timePickerBackButton");
    if (timePickerBackBtn) timePickerBackBtn.addEventListener('click', ()=>{
        if(currentTimePickerStep==='minute'){
            selectedMinute=null;
            $$('#timePickerMinutes button').forEach(b=>b.classList.remove('selected'));
            currentTimePickerStep='hour';
        } else if(currentTimePickerStep==='hour'){
            selectedHour12=null;
            $$('#timePickerHours button').forEach(b=>b.classList.remove('selected'));
            currentTimePickerStep='ampm';
        }
        updateTimePickerStepView();
    });

    const setTimeBtnEl = $("#setTimeButton");
    if (setTimeBtnEl) setTimeBtnEl.addEventListener('click', ()=>{
        if(activeTimeInput && selectedAmPm!=null && selectedHour12!=null && selectedMinute!=null){
            let hr24=parseInt(selectedHour12,10);
            if(selectedAmPm==="PM"&&hr24!==12)hr24+=12;
            if(selectedAmPm==="AM"&&hr24===12)hr24=0; 
            const timeString24 =`${String(hr24).padStart(2,'0')}:${String(selectedMinute).padStart(2,'0')}`;
            const timeString12 =`${String(selectedHour12).padStart(2,'0')}:${String(selectedMinute).padStart(2,'0')} ${selectedAmPm}`;
            activeTimeInput.value=timeString12;
            activeTimeInput.dataset.value24=timeString24;
            if(typeof timePickerCallback === 'function') timePickerCallback(timeString24);
        }
        closeModal('customTimePicker');
    });
    
    const cancelTimeBtnEl = $("#cancelTimeButton");
    if (cancelTimeBtnEl) cancelTimeBtnEl.addEventListener('click', ()=>closeModal('customTimePicker'));
    
    const agreementPdfBtn = $("#pdfBtn"); 
    if (agreementPdfBtn) agreementPdfBtn.addEventListener('click', () => { 
        generateAgreementPdf(); 
    });

    const inviteLinkElement = $("#invite");
    if (inviteLinkElement) inviteLinkElement.textContent=`${location.origin}${location.pathname}#register`; 

    const wizardFilesInput = $("#wFiles");
    if (wizardFilesInput) wizardFilesInput.addEventListener('change', displayUploadedFilesWizard); 
    
    const requestShiftBtn = $("#rqBtn");
    if (requestShiftBtn) requestShiftBtn.addEventListener('click', () => { 
        const rqModalEl = $("#rqModal"); if (rqModalEl) rqModalEl.style.display = "flex";
        $("#rqDate").value = new Date().toISOString().split('T')[0];
        $("#rqStart").value = ""; $("#rqStart").dataset.value24 = "";
        $("#rqEnd").value = ""; $("#rqEnd").dataset.value24 = "";
        $("#rqReason").value = "";
    });

    const logShiftBtn = $("#logTodayShiftBtn");
    if (logShiftBtn) logShiftBtn.addEventListener('click', openLogShiftModal);
    
    const signAgreementBtn = $("#signBtn"); 
    if (signAgreementBtn) signAgreementBtn.addEventListener('click', async () => { 
        signingAs = 'worker'; 
        const sigModalEl = $("#sigModal"); if (sigModalEl) sigModalEl.style.display = "flex";
        if(canvas && ctx) ctx.clearRect(0,0,canvas.width,canvas.height);
    });

    const participantSignBtnEl = $("#participantSignBtn"); 
    if (participantSignBtnEl) participantSignBtnEl.addEventListener('click', async () => { 
        signingAs = 'participant'; 
        const sigModalEl = $("#sigModal"); if (sigModalEl) sigModalEl.style.display = "flex";
        if(canvas && ctx) ctx.clearRect(0,0,canvas.width,canvas.height);
    });
    
    canvas = $("#pad"); 
    if (canvas) { 
        ctx = canvas.getContext("2d"); 
        if(ctx){ 
            ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round"; 
            canvas.onpointerdown=e=>{pen=true;ctx.beginPath();ctx.moveTo(e.offsetX,e.offsetY);}; 
            canvas.onpointermove=e=>{if(pen){ctx.lineTo(e.offsetX,e.offsetY);ctx.stroke();}}; 
            canvas.onpointerup=()=>{pen=false;ctx.closePath();}; 
            canvas.onpointerleave=()=>pen=false; 
        } else {
            console.error("Could not get 2D context for signature canvas.");
        }
    } else {
        console.warn("Signature canvas element #pad not found.");
    }

    const logoutButton = $("#logoutBtn");
    if (logoutButton) logoutButton.addEventListener('click', logout);

    const saveAuthBtn = $("#saveWorkerAuthorizationsBtn");
    if (saveAuthBtn) saveAuthBtn.addEventListener('click', saveWorkerAuthorizationsToFirestore); 
    
    window.addEventListener('hashchange', () => setActive(location.hash));
        
    console.log("[App] DOMContentLoaded processing complete.");
});

function handleAddAgreementClause() { 
    const clausesContainer = $("#adminAgreementClausesContainer");
    if (!clausesContainer) {
        showMessage("Error", "Clauses container not found in HTML.");
        return;
    }
    const newClauseIndex = clausesContainer.querySelectorAll('.agreement-clause-editor').length;
    const clauseDiv = document.createElement('div');
    clauseDiv.className = 'agreement-clause-editor';
    clauseDiv.innerHTML = `
        <div class="form-group">
            <label>Heading (Clause ${newClauseIndex + 1}):</label>
            <input type="text" class="clause-heading-input" placeholder="Enter clause heading">
        </div>
        <div class="form-group">
            <label>Body:</label>
            <textarea class="clause-body-textarea" rows="4" placeholder="Enter clause body. Use placeholders like {{participantName}}, {{workerName}}, {{serviceList}} where appropriate."></textarea>
        </div>
        <button class="btn-danger btn-small remove-clause-btn" data-index="${newClauseIndex}"><i class="fas fa-trash-alt"></i> Remove Clause</button>
        <hr class="compact-hr">
    `;
    clausesContainer.appendChild(clauseDiv);
    clauseDiv.querySelector('.remove-clause-btn').addEventListener('click', function() {
        this.closest('.agreement-clause-editor').remove();
        clausesContainer.querySelectorAll('.agreement-clause-editor').forEach((editor, idx) => {
            const headingLabel = editor.querySelector('label:first-of-type');
            if (headingLabel) headingLabel.textContent = `Heading (Clause ${idx + 1}):`;
            const removeBtn = editor.querySelector('.remove-clause-btn');
            if (removeBtn) removeBtn.dataset.index = idx;
        });
        renderAdminAgreementPreview(); 
    });
}

function handleHomePageDisplay() { 
    if (currentUserId) {
        const homeUserDiv = $("#homeUser");
        if (homeUserDiv) homeUserDiv.classList.remove('hide');
        const userNameDisplaySpan = $("#userNameDisplay");
        if (userNameDisplaySpan) userNameDisplaySpan.textContent = profile.name || (currentUserEmail ? currentUserEmail.split('@')[0] : "User");
        
        loadShiftRequestsForUserDisplay();

    } else {
        const homeUserDiv = $("#homeUser");
        if (homeUserDiv) homeUserDiv.classList.add('hide');
    }
}

async function loadShiftRequestsForUserDisplay() {
    const shiftRequestsContainer = $("#shiftRequestsContainer");
    const rqTblBody = $("#rqTbl tbody");
    if (!shiftRequestsContainer || !rqTblBody || !currentUserId || !isFirebaseInitialized) return;

    showLoading("Loading shift requests...");
    rqTblBody.innerHTML = "<tr><td colspan='5'>Loading requests...</td></tr>";

    try {
        let q;
        if (profile.isAdmin) {
            q = query(collection(fsDb, `artifacts/${appId}/public/data/shiftRequests`)); 
        } else {
            q = query(collection(fsDb, `artifacts/${appId}/public/data/shiftRequests`), where("userId", "==", currentUserId));
        }
        
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            rqTblBody.innerHTML = "<tr><td colspan='5'>No shift requests found.</td></tr>";
        } else {
            rqTblBody.innerHTML = ""; 
            querySnapshot.forEach(docSnap => {
                const req = docSnap.data();
                const tr = rqTblBody.insertRow();
                tr.insertCell().textContent = formatDateForInvoiceDisplay(req.date);
                tr.insertCell().textContent = formatTime12Hour(req.startTime);
                tr.insertCell().textContent = formatTime12Hour(req.endTime);
                tr.insertCell().textContent = req.reason || "N/A";
                
                const statusCell = tr.insertCell();
                statusCell.textContent = req.status.charAt(0).toUpperCase() + req.status.slice(1);
                statusCell.className = `status-${req.status}`; 
            });
        }
        shiftRequestsContainer.classList.remove('hide');
    } catch (error) {
        console.error("Error loading shift requests:", error);
        rqTblBody.innerHTML = "<tr><td colspan='5'>Error loading requests.</td></tr>";
        showMessage("Data Error", "Could not load shift requests: " + error.message);
    } finally {
        hideLoading();
    }
}


function filterTravelCodeList() { 
    const filterInputElement = $("#travelCodeFilterInput");
    const filterText = filterInputElement ? filterInputElement.value.toLowerCase() : ""; 
    $$("#travelCodeListContainer li").forEach(li => { 
        const itemText = li.textContent ? li.textContent.toLowerCase() : "";
        li.style.display = itemText.includes(filterText) ? "" : "none"; 
    });
}

function displayUploadedFilesWizard() { 
    const fileInput = $("#wFiles");
    const fileListDiv = $("#wFilesList");
    if (!fileInput || !fileListDiv) return;

    fileListDiv.innerHTML = ''; 
    if (fileInput.files.length > 0) {
        Array.from(fileInput.files).forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            fileListDiv.appendChild(fileDiv);
        });
    } else {
        fileListDiv.textContent = 'No files selected.';
    }
}

function openLogShiftModal() { 
    const logShiftModalEl = $("#logShiftModal");
    if (logShiftModalEl) {
        const dateInput = $("#logShiftDate");
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0]; 

        const supportTypeSelect = $("#logShiftSupportType");
        if (supportTypeSelect) { 
            supportTypeSelect.innerHTML = "<option value=''>Loading services...</option>";
            if (profile && profile.authorizedServiceCodes && adminManagedServices.length > 0) {
                supportTypeSelect.innerHTML = "<option value=''>-- Select Support Type --</option>";
                profile.authorizedServiceCodes.forEach(code => {
                    const service = adminManagedServices.find(s => s.code === code && s.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM);
                    if (service) {
                        const opt = document.createElement('option');
                        opt.value = service.code;
                        opt.textContent = `${service.description} (${service.code})`;
                        supportTypeSelect.appendChild(opt);
                    }
                });
                 if (supportTypeSelect.options.length <= 1) { 
                    supportTypeSelect.innerHTML = "<option value=''>No suitable services authorized.</option>";
                }
            } else if (adminManagedServices.length === 0) {
                 supportTypeSelect.innerHTML = "<option value=''>No services defined by admin</option>";
            } else {
                 supportTypeSelect.innerHTML = "<option value=''>No services authorized or available</option>";
            }
        }
        
        const startTimeInput = $("#logShiftStartTime"); 
        if (startTimeInput) { 
            startTimeInput.value = ""; 
            startTimeInput.dataset.value24 = "";
            startTimeInput.onclick = () => openCustomTimePicker(startTimeInput, null); 
        }
        const endTimeInput = $("#logShiftEndTime"); 
        if (endTimeInput) { 
            endTimeInput.value = ""; 
            endTimeInput.dataset.value24 = "";
            endTimeInput.onclick = () => openCustomTimePicker(endTimeInput, null); 
        }
        
        const claimTravelToggle = $("#logShiftClaimTravelToggle"); 
        if (claimTravelToggle) {
            claimTravelToggle.checked = false;
            claimTravelToggle.removeEventListener('change', handleLogShiftTravelToggle); 
            claimTravelToggle.addEventListener('change', handleLogShiftTravelToggle); 
        }
        const kmFieldsContainer = $("#logShiftKmFieldsContainer"); if (kmFieldsContainer) kmFieldsContainer.classList.add('hide');
        const startKmInput = $("#logShiftStartKm"); if (startKmInput) { startKmInput.value = ""; startKmInput.oninput = calculateLogShiftTravelKm; }
        const endKmInput = $("#logShiftEndKm"); if (endKmInput) { endKmInput.value = ""; endKmInput.oninput = calculateLogShiftTravelKm; }
        const calculatedKmSpan = $("#logShiftCalculatedKm"); if (calculatedKmSpan) calculatedKmSpan.textContent = "0.0 Km";

        logShiftModalEl.style.display = "flex";
    } else {
        showMessage("Error", "Log shift modal element not found.");
    }
}

function handleLogShiftTravelToggle() {
    const kmFieldsContainer = $("#logShiftKmFieldsContainer");
    if (this.checked) {
        kmFieldsContainer.classList.remove('hide');
    } else {
        kmFieldsContainer.classList.add('hide');
        $("#logShiftStartKm").value = "";
        $("#logShiftEndKm").value = "";
        $("#logShiftCalculatedKm").textContent = "0.0 Km";
    }
}
function calculateLogShiftTravelKm() {
    const startKm = parseFloat($("#logShiftStartKm")?.value) || 0;
    const endKm = parseFloat($("#logShiftEndKm")?.value) || 0;
    const calculatedKmSpan = $("#logShiftCalculatedKm");
    if (endKm > startKm) {
        calculatedKmSpan.textContent = `${(endKm - startKm).toFixed(1)} Km`;
    } else {
        calculatedKmSpan.textContent = "0.0 Km";
    }
}


function updateRateFieldsVisibility(categoryType) { 
    const container = $("#adminServiceRateFieldsContainer"); 
    if(!container) return; 
    container.innerHTML = ""; 
    
    if (categoryType === SERVICE_CATEGORY_TYPES.CORE_STANDARD || categoryType === SERVICE_CATEGORY_TYPES.CORE_HIGH_INTENSITY) { 
        RATE_CATEGORIES.forEach(cat => { 
            const div = document.createElement('div'); 
            div.className = 'form-group'; 
            div.innerHTML = `<label for="adminServiceRate_${cat}">Rate - ${cat.charAt(0).toUpperCase() + cat.slice(1)} ($):</label><input type="number" id="adminServiceRate_${cat}" step="0.01" min="0" placeholder="e.g., 55.75">`; 
            container.appendChild(div); 
        }); 
    } else if (categoryType === SERVICE_CATEGORY_TYPES.CAPACITY_THERAPY_STD || categoryType === SERVICE_CATEGORY_TYPES.CAPACITY_SPECIALIST || categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) { 
        const div = document.createElement('div'); 
        div.className = 'form-group'; 
        div.innerHTML = `<label for="adminServiceRate_standardRate">Standard Rate ($):</label><input type="number" id="adminServiceRate_standardRate" step="0.01" min="0" placeholder="e.g., 193.99">`; 
        container.appendChild(div); 
    } else if (categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) { 
        const div = document.createElement('div'); 
        div.className = 'form-group'; 
        div.innerHTML = `<label for="adminServiceRate_perKmRate">Rate per KM ($):</label><input type="number" id="adminServiceRate_perKmRate" step="0.01" min="0" placeholder="e.g., 0.97">`; 
        container.appendChild(div); 
    } 
    const serviceIdBeingEdited = $("#adminServiceId")?.value; 
    if (serviceIdBeingEdited) { 
        const service = adminManagedServices.find(s => s.id === serviceIdBeingEdited); 
        if (service?.rates && service.categoryType === categoryType) { 
            Object.keys(service.rates).forEach(rateKey => { 
                let fieldIdSuffix = rateKey;
                const rateField = $(`#adminServiceRate_${fieldIdSuffix}`); 
                if (rateField) rateField.value = service.rates[rateKey]; 
            }); 
        }
    }
}

function renderAdminServicesTable() { 
    const tbody = $("#adminServicesTable tbody"); 
    if (!tbody) return; 
    tbody.innerHTML = ""; 
    if (adminManagedServices.length === 0) {
        const tr = tbody.insertRow();
        const td = tr.insertCell();
        td.colSpan = 6; 
        td.textContent = "No NDIS services defined yet. Add services using the form above.";
        td.style.textAlign = "center";
        return;
    }

    adminManagedServices.forEach(s => { 
        const tr = tbody.insertRow(); 
        tr.insertCell().textContent = s.code || "N/A"; 
        tr.insertCell().textContent = s.description || "N/A"; 
        tr.insertCell().textContent = s.categoryType ? s.categoryType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : "N/A"; 
        
        let primaryRateDisplay="N/A";
        if(s.rates){
            if(s.rates.weekday !== undefined) primaryRateDisplay=`$${parseFloat(s.rates.weekday).toFixed(2)}`;
            else if(s.rates.standardRate !== undefined) primaryRateDisplay=`$${parseFloat(s.rates.standardRate).toFixed(2)}`;
            else if(s.rates.perKmRate !== undefined) primaryRateDisplay=`$${parseFloat(s.rates.perKmRate).toFixed(2)}/km`;
        } 
        tr.insertCell().textContent = primaryRateDisplay; 
        tr.insertCell().textContent = s.travelCode || "None"; 
        
        const actionsCell = tr.insertCell(); 
        actionsCell.innerHTML=`<button onclick="editAdminService('${s.id}')" class="btn-secondary btn-small" title="Edit Service"><i class="fas fa-edit"></i></button> <button onclick="deleteAdminService('${s.id}')" class="btn-danger btn-small" title="Delete Service"><i class="fas fa-trash-alt"></i></button>`; 
    });
}

window.editAdminService = function(serviceId) { 
    const serviceToEdit = adminManagedServices.find(item => item.id === serviceId); 
    if (!serviceToEdit) {
        showMessage("Error", "Service not found for editing.");
        return;
    }
    $("#adminServiceId").value = serviceToEdit.id; 
    $("#adminServiceCode").value = serviceToEdit.code; 
    $("#adminServiceDescription").value = serviceToEdit.description; 
    $("#adminServiceCategoryType").value = serviceToEdit.categoryType; 
    
    updateRateFieldsVisibility(serviceToEdit.categoryType); 
    
    $("#adminServiceTravelCode").value = serviceToEdit.travelCode || ""; 
    const associatedTravelService = adminManagedServices.find(ts => ts.code === serviceToEdit.travelCode); 
    $("#adminServiceTravelCodeDisplay").value = associatedTravelService ? `${associatedTravelService.description} (${associatedTravelService.code})` : "None selected"; 
    
    $("#adminServiceFormContainer h4").innerHTML = `<i class="fas fa-edit"></i> Edit Service: ${serviceToEdit.code}`; 
    const serviceCodeInputEl = $("#adminServiceCode");
    if (serviceCodeInputEl) serviceCodeInputEl.focus(); 
};

window.deleteAdminService = async function(serviceId) { 
    const service = adminManagedServices.find(s => s.id === serviceId);
    if (!service) { showMessage("Error", "Service not found for deletion."); return; }
    showMessage("Confirm Delete", 
        `Are you sure you want to delete the service "${service.description} (${service.code})"? This cannot be undone.<br><br>
         <div class='modal-actions' style='justify-content: center; margin-top: 15px;'>
           <button onclick='_confirmDeleteServiceFirestore("${serviceId}")' class='btn-danger'><i class="fas fa-trash-alt"></i> Yes, Delete</button>
           <button class='btn-secondary' onclick='closeModal("messageModal")'><i class="fas fa-times"></i> No, Cancel</button>
         </div>`);
};

window._confirmDeleteServiceFirestore = async function(serviceId) { 
    closeModal("messageModal"); 
    showLoading("Deleting service...");
    const success = await deleteAdminServiceFromFirestore(serviceId); 
    hideLoading();
    if (success) { 
        renderAdminServicesTable(); 
        clearAdminServiceForm(); 
        showMessage("Success", "Service deleted successfully."); 
    } 
};

window.saveAdminService = async function() { 
    const serviceId = $("#adminServiceId")?.value; 
    const serviceCode = $("#adminServiceCode")?.value.trim();
    const serviceDescription = $("#adminServiceDescription")?.value.trim();
    const serviceCategoryType = $("#adminServiceCategoryType")?.value;
    const serviceTravelCode = $("#adminServiceTravelCode")?.value.trim() || null; 
    
    const rates = {}; 
    let allRatesValid = true; 
    let firstInvalidRateField = null;

    if (!serviceCode || !serviceDescription || !serviceCategoryType) { 
        return showMessage("Validation Error", "Service Code, Description, and Category Type are required."); 
    }
    
    if (serviceCategoryType === SERVICE_CATEGORY_TYPES.CORE_STANDARD || serviceCategoryType === SERVICE_CATEGORY_TYPES.CORE_HIGH_INTENSITY) { 
        RATE_CATEGORIES.forEach(cat => { 
            const input = $(`#adminServiceRate_${cat}`); 
            if (input) { 
                const valStr = input.value.trim(); 
                if (valStr === "") { rates[cat] = 0; } 
                else { const val = parseFloat(valStr); if (isNaN(val) || val < 0) { if(allRatesValid) firstInvalidRateField = input; allRatesValid = false; rates[cat] = 0; } else { rates[cat] = val; } } 
            } else { allRatesValid = false; rates[cat] = 0;} 
        });
    } else if (serviceCategoryType === SERVICE_CATEGORY_TYPES.CAPACITY_THERAPY_STD || serviceCategoryType === SERVICE_CATEGORY_TYPES.CAPACITY_SPECIALIST || serviceCategoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) { 
        const input = $("#adminServiceRate_standardRate"); 
        if (input) { 
            const valStr = input.value.trim(); 
            if (valStr === "") { rates.standardRate = 0; } 
            else { const val = parseFloat(valStr); if (isNaN(val) || val < 0) { if(allRatesValid) firstInvalidRateField = input; allRatesValid = false; rates.standardRate = 0; } else { rates.standardRate = val; } } 
        } else { allRatesValid = false; rates.standardRate = 0;}
    } else if (serviceCategoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) { 
        const input = $("#adminServiceRate_perKmRate"); 
        if (input) { 
            const valStr = input.value.trim(); 
            if (valStr === "") { rates.perKmRate = 0; } 
            else { const val = parseFloat(valStr); if (isNaN(val) || val < 0) { if(allRatesValid) firstInvalidRateField = input; allRatesValid = false; rates.perKmRate = 0; } else { rates.perKmRate = val; } } 
        } else { allRatesValid = false; rates.perKmRate = 0;} 
    }

    if (!allRatesValid) { 
        showMessage("Validation Error", "All rate fields must contain valid, non-negative numbers."); 
        if(firstInvalidRateField) firstInvalidRateField.focus(); 
        return; 
    }
    if ((serviceCategoryType === SERVICE_CATEGORY_TYPES.CORE_STANDARD || serviceCategoryType === SERVICE_CATEGORY_TYPES.CORE_HIGH_INTENSITY) && (rates.weekday === undefined || rates.weekday <= 0)) { 
        showMessage("Validation Error", "Weekday rate must be greater than 0 for Core services."); 
        const weekdayRateField = $("#adminServiceRate_weekday");
        if (weekdayRateField) weekdayRateField.focus(); 
        return; 
    }
     if (serviceCategoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM && (rates.perKmRate === undefined || rates.perKmRate <= 0)) {
        showMessage("Validation Error", "Rate per KM must be greater than 0 for Travel services.");
        const perKmRateField = $("#adminServiceRate_perKmRate");
        if (perKmRateField) perKmRateField.focus();
        return;
    }


    const servicePayload = { 
        code: serviceCode, 
        description: serviceDescription, 
        categoryType: serviceCategoryType, 
        rates: rates, 
        travelCode: serviceTravelCode, 
        isActiveInAgreement: true 
    }; 
    
    showLoading(serviceId ? "Updating service..." : "Adding service...");
    const success = await saveAdminServiceToFirestore(servicePayload, serviceId || null); 
    hideLoading();
    if (success) { 
        renderAdminServicesTable(); 
        clearAdminServiceForm(); 
        showMessage("Success", `Service ${serviceId ? 'updated' : 'added'} successfully.`); 
    }
};


function loadAdminPortalSettings() { 
    if (!(profile?.isAdmin) || !isFirebaseInitialized) return; 
    
    const orgNameInput = $("#adminEditOrgName"); if (orgNameInput) orgNameInput.value = globalSettings.organizationName || "";
    const orgAbnInput = $("#adminEditOrgAbn"); if (orgAbnInput) orgAbnInput.value = globalSettings.organizationAbn || "";
    const orgEmailInput = $("#adminEditOrgContactEmail"); if (orgEmailInput) orgEmailInput.value = globalSettings.organizationContactEmail || "";
    const orgPhoneInput = $("#adminEditOrgContactPhone"); if (orgPhoneInput) orgPhoneInput.value = globalSettings.organizationContactPhone || "";
    
    const participantNameInput = $("#adminEditParticipantName"); if (participantNameInput) participantNameInput.value = globalSettings.participantName || "";
    const participantNdisNoInput = $("#adminEditParticipantNdisNo"); if (participantNdisNoInput) participantNdisNoInput.value = globalSettings.participantNdisNo || "";
    const planManagerNameInput = $("#adminEditPlanManagerName"); if (planManagerNameInput) planManagerNameInput.value = globalSettings.planManagerName || "";
    const planManagerEmailInput = $("#adminEditPlanManagerEmail"); if (planManagerEmailInput) planManagerEmailInput.value = globalSettings.planManagerEmail || "";
    const planManagerPhoneInput = $("#adminEditPlanManagerPhone"); if (planManagerPhoneInput) planManagerPhoneInput.value = globalSettings.planManagerPhone || "";
    const planEndDateInput = $("#adminEditPlanEndDate"); if (planEndDateInput) planEndDateInput.value = globalSettings.planEndDate || "";

    const orgDetailsSection = $("#adminEditOrgDetailsSection");
    const participantTitle = $("#adminEditParticipantTitle");
    const hrSeparator = $("#adminEditParticipantHr");

    if (globalSettings.portalType === 'participant') {
        if (orgDetailsSection) orgDetailsSection.classList.add('hide'); 
        if (hrSeparator) hrSeparator.classList.add('hide');
        if (participantTitle) participantTitle.innerHTML = `<i class="fas fa-child"></i> Your (Participant) & Plan Details`;
    } else { 
        if (orgDetailsSection) orgDetailsSection.classList.remove('hide');
        if (hrSeparator) hrSeparator.classList.remove('hide');
        if (participantTitle) participantTitle.innerHTML = `<i class="fas fa-child"></i> Default Participant & Plan Details`;
    }
} 

function loadAdminAgreementCustomizations() { 
    if (!isFirebaseInitialized) return;
    if (typeof agreementCustomData !== 'object' || agreementCustomData === null) {
        agreementCustomData = { overallTitle: "NDIS Service Agreement (Default)", clauses: [] };
    }

    const overallTitleInput = $("#adminAgreementOverallTitle");
    if (overallTitleInput) overallTitleInput.value = agreementCustomData.overallTitle || "NDIS Service Agreement";
    
    const clausesContainer = $("#adminAgreementClausesContainer"); 
    if(!clausesContainer) return; 
    clausesContainer.innerHTML = ""; 
    
    (agreementCustomData.clauses || []).forEach((clause, index) => { 
        const clauseDiv = document.createElement('div'); 
        clauseDiv.className = 'agreement-clause-editor'; 
        clauseDiv.innerHTML = `
            <div class="form-group">
                <label>Heading (Clause ${index + 1}):</label>
                <input type="text" class="clause-heading-input" value="${clause.heading || ''}">
            </div>
            <div class="form-group">
                <label>Body:</label>
                <textarea class="clause-body-textarea" rows="4">${clause.body || ''}</textarea>
            </div>
            <button class="btn-danger btn-small remove-clause-btn" data-index="${index}"><i class="fas fa-trash-alt"></i> Remove</button>
            <hr class="compact-hr">
        `; 
        clausesContainer.appendChild(clauseDiv); 
        clauseDiv.querySelector('.remove-clause-btn').addEventListener('click', function() {
            this.closest('.agreement-clause-editor').remove();
            clausesContainer.querySelectorAll('.agreement-clause-editor').forEach((editor, idx) => {
                const headingLabel = editor.querySelector('label:first-of-type');
                if (headingLabel) headingLabel.textContent = `Heading (Clause ${idx + 1}):`;
                const removeBtn = editor.querySelector('.remove-clause-btn');
                if (removeBtn) removeBtn.dataset.index = idx;
            });
            renderAdminAgreementPreview(); 
        });
    }); 
    renderAdminAgreementPreview(); 
}

function renderAdminAgreementPreview() { 
    const previewBox = $("#adminAgreementPreview"); 
    if (!previewBox) return; 
    
     if (typeof agreementCustomData !== 'object' || agreementCustomData === null) {
        agreementCustomData = { overallTitle: "Preview Unavailable", clauses: [] };
    }

    const overallTitleFromInput = $("#adminAgreementOverallTitle")?.value.trim() || agreementCustomData.overallTitle || "Service Agreement Preview";
    previewBox.innerHTML = `<h2>${overallTitleFromInput}</h2>`; 
    
    const clausesContainer = $("#adminAgreementClausesContainer");
    if (clausesContainer && clausesContainer.querySelectorAll('.agreement-clause-editor').length > 0) {
        clausesContainer.querySelectorAll('.agreement-clause-editor').forEach(clauseDiv => {
            const heading = clauseDiv.querySelector('.clause-heading-input')?.value.trim();
            const body = clauseDiv.querySelector('.clause-body-textarea')?.value.trim();
            if (heading) previewBox.innerHTML += `<h4>${heading}</h4>`;
            if (body) previewBox.innerHTML += `<div>${body.replace(/\n/g, '<br>')}</div>`;
        });
    } else if (!(agreementCustomData.clauses || []).length) {
        previewBox.innerHTML = "<p><em>No clauses defined. Add clauses above and save to see a preview.</em></p>";
    } else { 
         (agreementCustomData.clauses || []).forEach(c => {
            if(c.heading) previewBox.innerHTML += `<h4>${c.heading}</h4>`;
            if(c.body) previewBox.innerHTML += `<div>${(c.body || "").replace(/\n/g, '<br>')}</div>`;
        });
    }
}

function populateAdminWorkerSelectorForAgreement() { 
    const selector = $("#adminSelectWorkerForAgreement"); 
    if (!selector) return; 
    selector.innerHTML = '<option value="">-- Select a Support Worker --</option>'; 
    Object.entries(accounts).forEach(([key, acc]) => { 
        if (acc && acc.profile && !acc.profile.isAdmin) { 
            const workerProfile = acc.profile;
            const displayIdentifier = workerProfile.email || key;
            const opt = document.createElement('option'); 
            opt.value = key; 
            opt.textContent = `${workerProfile.name || 'Unnamed Worker'} (${displayIdentifier})`; 
            selector.appendChild(opt); 
        } 
    }); 
}

window.loadServiceAgreementForSelectedWorker = function() { 
    const selectedKey = $("#adminSelectWorkerForAgreement")?.value; 
    if (selectedKey) { 
        currentAgreementWorkerEmail = selectedKey; 
        loadServiceAgreement(); 
    } else { 
        const agreementContainer = $("#agreementContentContainer");
        if (agreementContainer) agreementContainer.innerHTML = "<p><em>Please select a worker to load their service agreement.</em></p>"; 
        const agrChipEl = $("#agrChip"); if (agrChipEl) { agrChipEl.className = "chip yellow"; agrChipEl.textContent = "Select Worker"; }
    }
};

async function loadServiceAgreement() { 
    if (!currentUserId || !isFirebaseInitialized) {
        $("#agreementContentContainer").innerHTML = "<p><em>Error: User not logged in or Firebase not ready.</em></p>";
        return;
    }
    if (typeof agreementCustomData !== 'object' || agreementCustomData === null) {
         // Attempt to load it if it's missing, then proceed or show error
        await loadAgreementCustomizationsFromFirestore();
        if (typeof agreementCustomData !== 'object' || agreementCustomData === null) {
            $("#agreementContentContainer").innerHTML = "<p><em>Error: Agreement template data is missing and could not be loaded.</em></p>";
            return;
        }
    }


    let workerProfileToUse;
    let workerName, workerAbn;
    let agreementDocPath; 

    if (profile.isAdmin && currentAgreementWorkerEmail) { 
        workerProfileToUse = accounts[currentAgreementWorkerEmail]?.profile;
        if (!workerProfileToUse) {
            $("#agreementContentContainer").innerHTML = "<p><em>Error: Selected worker profile not found.</em></p>";
            return;
        }
        workerName = workerProfileToUse.name;
        workerAbn = workerProfileToUse.abn;
        $("#agreementDynamicTitle").innerHTML = `<i class="fas fa-handshake"></i> Service Agreement for ${workerName}`;
        agreementDocPath = `artifacts/${appId}/users/${workerProfileToUse.uid}/agreements/main`; 
    } else if (!profile.isAdmin && currentUserId) { 
        workerProfileToUse = profile;
        workerName = profile.name;
        workerAbn = profile.abn;
        $("#agreementDynamicTitle").innerHTML = `<i class="fas fa-handshake"></i> Your Service Agreement`;
        agreementDocPath = `artifacts/${appId}/users/${currentUserId}/agreements/main`;
    } else {
        $("#agreementContentContainer").innerHTML = "<p><em>Cannot determine whose agreement to load.</em></p>";
        return;
    }

    const agreementContainer = $("#agreementContentContainer");
    if (!agreementContainer) return;

    let agreementInstanceData = { workerSigned: false, participantSigned: false, workerSigUrl: null, participantSigUrl: null, workerSignDate: null, participantSignDate: null, agreementStartDate: globalSettings.agreementStartDate };
    try {
        const agreementInstanceRef = doc(fsDb, agreementDocPath);
        const agreementInstanceSnap = await getDoc(agreementInstanceRef);
        if (agreementInstanceSnap.exists()) {
            agreementInstanceData = { ...agreementInstanceData, ...agreementInstanceSnap.data() };
        } else {
            await setDoc(agreementInstanceRef, { agreementStartDate: globalSettings.agreementStartDate || new Date().toISOString().split('T')[0], lastUpdated: serverTimestamp() });
        }
    } catch (e) {
        console.warn("Could not load existing agreement instance data:", e);
    }

    let content = `<h2>${agreementCustomData.overallTitle || "Service Agreement"}</h2>`;
    (agreementCustomData.clauses || []).forEach(clause => {
        let clauseBody = clause.body || "";
        clauseBody = clauseBody.replace(/{{participantName}}/g, globalSettings.participantName || "[Participant Name]")
                               .replace(/{{participantNdisNo}}/g, globalSettings.participantNdisNo || "[NDIS No]")
                               .replace(/{{workerName}}/g, workerName || "[Worker Name]")
                               .replace(/{{workerAbn}}/g, workerAbn || "[Worker ABN]")
                               .replace(/{{agreementStartDate}}/g, formatDateForInvoiceDisplay(agreementInstanceData.agreementStartDate || globalSettings.agreementStartDate || new Date())) 
                               .replace(/{{agreementEndDate}}/g, formatDateForInvoiceDisplay(globalSettings.planEndDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)))); 

        let serviceListHtml = "<ul>";
        const authorizedCodes = workerProfileToUse.authorizedServiceCodes || [];
        if (authorizedCodes.length > 0) {
            authorizedCodes.forEach(code => {
                const serviceDetail = adminManagedServices.find(s => s.code === code);
                serviceListHtml += `<li>${serviceDetail ? serviceDetail.description : code}</li>`;
            });
        } else {
            serviceListHtml += "<li>No specific services listed/authorized. General support will be provided.</li>";
        }
        serviceListHtml += "</ul>";
        clauseBody = clauseBody.replace(/{{serviceList}}/g, serviceListHtml);
        
        content += `<h4>${clause.heading || ""}</h4><div>${clauseBody.replace(/\n/g, '<br>')}</div>`;
    });
    agreementContainer.innerHTML = content;

    const sigPImg = $("#sigP"); const dPEl = $("#dP");
    const sigWImg = $("#sigW"); const dWEl = $("#dW");

    if (agreementInstanceData.participantSigUrl && sigPImg) sigPImg.src = agreementInstanceData.participantSigUrl; else if (sigPImg) sigPImg.src = "";
    if (agreementInstanceData.participantSignDate && dPEl) dPEl.textContent = formatDateForInvoiceDisplay(agreementInstanceData.participantSignDate.toDate ? agreementInstanceData.participantSignDate.toDate() : agreementInstanceData.participantSignDate); else if (dPEl) dPEl.textContent = "___";
    
    if (agreementInstanceData.workerSigUrl && sigWImg) sigWImg.src = agreementInstanceData.workerSigUrl; else if (sigWImg) sigWImg.src = "";
    if (agreementInstanceData.workerSignDate && dWEl) dWEl.textContent = formatDateForInvoiceDisplay(agreementInstanceData.workerSignDate.toDate ? agreementInstanceData.workerSignDate.toDate() : agreementInstanceData.workerSignDate); else if (dWEl) dWEl.textContent = "___";

    const agrChipEl = $("#agrChip");
    const signBtnEl = $("#signBtn"); 
    const participantSignBtnEl = $("#participantSignBtn");
    const pdfBtnEl = $("#pdfBtn");

    if (agreementInstanceData.workerSigned && agreementInstanceData.participantSigned) {
        if (agrChipEl) { agrChipEl.className = "chip green"; agrChipEl.textContent = "Signed & Active"; }
        if (signBtnEl) signBtnEl.classList.add("hide");
        if (participantSignBtnEl) participantSignBtnEl.classList.add("hide");
    } else if (agreementInstanceData.workerSigned) {
        if (agrChipEl) { agrChipEl.className = "chip yellow"; agrChipEl.textContent = "Worker Signed - Awaiting Participant"; }
        if (signBtnEl) signBtnEl.classList.add("hide");
        if (participantSignBtnEl) participantSignBtnEl.classList.remove("hide"); 
    } else if (agreementInstanceData.participantSigned) {
        if (agrChipEl) { agrChipEl.className = "chip yellow"; agrChipEl.textContent = "Participant Signed - Awaiting Worker"; }
        if (signBtnEl) signBtnEl.classList.remove("hide"); 
        if (participantSignBtnEl) participantSignBtnEl.classList.add("hide");
    } else { 
        if (agrChipEl) { agrChipEl.className = "chip yellow"; agrChipEl.textContent = "Draft - Awaiting Signatures"; }
        if (signBtnEl) signBtnEl.classList.remove("hide");
        if (participantSignBtnEl) participantSignBtnEl.classList.remove("hide");
    }
    
    if (pdfBtnEl) pdfBtnEl.classList.remove("hide"); 

    if (profile.isAdmin) { 
        if (signBtnEl) signBtnEl.classList.add("hide");
        if (participantSignBtnEl) participantSignBtnEl.classList.add("hide");
    } else { 
        if (currentUserId === workerProfileToUse.uid) { 
            if (agreementInstanceData.workerSigned && signBtnEl) signBtnEl.classList.add("hide"); else if (signBtnEl) signBtnEl.classList.remove("hide");
            if (participantSignBtnEl) participantSignBtnEl.classList.add("hide"); 
        } else { 
             if (signBtnEl) signBtnEl.classList.add("hide");
             if (participantSignBtnEl) participantSignBtnEl.classList.add("hide");
        }
    }
}

async function generateAgreementPdf() {
    if (!currentUserId || !profile || !agreementCustomData) {
        showMessage("Error", "Required data for PDF generation is missing.");
        return;
    }

    let workerProfileToUse = profile; // Default to current user
    let workerName = profile.name;
    let workerAbn = profile.abn;

    if (profile.isAdmin && currentAgreementWorkerEmail) {
        const selectedWorker = accounts[currentAgreementWorkerEmail]?.profile;
        if (selectedWorker) {
            workerProfileToUse = selectedWorker;
            workerName = selectedWorker.name;
            workerAbn = selectedWorker.abn;
        } else {
            showMessage("Error", "Selected worker profile for PDF not found.");
            return;
        }
    }
    
    let agreementInstanceData = { workerSigUrl: $("#sigW")?.src, participantSigUrl: $("#sigP")?.src, workerSignDate: $("#dW")?.textContent, participantSignDate: $("#dP")?.textContent, agreementStartDate: globalSettings.agreementStartDate };
    try {
        const agreementDocPath = `artifacts/${appId}/users/${workerProfileToUse.uid}/agreements/main`;
        const agreementInstanceRef = doc(fsDb, agreementDocPath);
        const agreementInstanceSnap = await getDoc(agreementInstanceRef);
        if (agreementInstanceSnap.exists()) {
            const firestoreData = agreementInstanceSnap.data();
            agreementInstanceData.workerSigUrl = firestoreData.workerSigUrl || agreementInstanceData.workerSigUrl;
            agreementInstanceData.participantSigUrl = firestoreData.participantSigUrl || agreementInstanceData.participantSigUrl;
            agreementInstanceData.workerSignDate = firestoreData.workerSignDate ? formatDateForInvoiceDisplay(firestoreData.workerSignDate.toDate()) : agreementInstanceData.workerSignDate;
            agreementInstanceData.participantSignDate = firestoreData.participantSignDate ? formatDateForInvoiceDisplay(firestoreData.participantSignDate.toDate()) : agreementInstanceData.participantSignDate;
            agreementInstanceData.agreementStartDate = firestoreData.agreementStartDate || agreementInstanceData.agreementStartDate;
        }
    } catch(e) { console.warn("Could not fetch latest agreement instance for PDF:", e); }


    let pdfHtml = `
        <style>
            body { font-family: 'Inter', sans-serif; font-size: 10pt; color: #333; }
            .pdf-agreement-container { padding: 20mm; }
            .pdf-agreement-header h1 { font-size: 18pt; text-align: center; margin-bottom: 5mm; color: #000; }
            .pdf-agreement-header h2 { font-size: 14pt; text-align: center; margin-bottom: 10mm; color: #222; }
            .pdf-clause h4 { font-size: 12pt; margin-top: 8mm; margin-bottom: 3mm; color: #111; border-bottom: 1px solid #eee; padding-bottom: 2mm;}
            .pdf-clause div { margin-bottom: 5mm; line-height: 1.5; text-align: justify; }
            .pdf-clause ul { padding-left: 20px; margin-bottom: 5mm; }
            .pdf-clause li { margin-bottom: 2mm; }
            .pdf-signatures { margin-top: 15mm; display: flex; justify-content: space-around; page-break-inside: avoid; }
            .pdf-signature-block { width: 45%; text-align: center; }
            .pdf-signature-block img { width: 150px; height: 50px; border: 1px dashed #ccc; margin-bottom: 5mm; background-color: #f9f9f9; object-fit: contain; }
            .pdf-signature-block p { margin: 2mm 0; font-size: 9pt; }
        </style>
        <div class="pdf-agreement-container">
            <div class="pdf-agreement-header">
                 <h1>${globalSettings.organizationName || 'Service Provider'}</h1>
                 <h2>${agreementCustomData.overallTitle || "Service Agreement"}</h2>
            </div>`;

    (agreementCustomData.clauses || []).forEach(clause => {
        let clauseBody = clause.body || "";
        clauseBody = clauseBody.replace(/{{participantName}}/g, globalSettings.participantName || "[Participant Name]")
                               .replace(/{{participantNdisNo}}/g, globalSettings.participantNdisNo || "[NDIS No]")
                               .replace(/{{workerName}}/g, workerName || "[Worker Name]")
                               .replace(/{{workerAbn}}/g, workerAbn || "[Worker ABN]")
                               .replace(/{{agreementStartDate}}/g, formatDateForInvoiceDisplay(agreementInstanceData.agreementStartDate || globalSettings.agreementStartDate || new Date()))
                               .replace(/{{agreementEndDate}}/g, formatDateForInvoiceDisplay(globalSettings.planEndDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1))));
        
        let serviceListHtml = "<ul>";
        const authorizedCodes = workerProfileToUse.authorizedServiceCodes || [];
        if (authorizedCodes.length > 0) {
            authorizedCodes.forEach(code => {
                const serviceDetail = adminManagedServices.find(s => s.code === code);
                serviceListHtml += `<li>${serviceDetail ? serviceDetail.description : code}</li>`;
            });
        } else {
            serviceListHtml += "<li>No specific services listed/authorized.</li>";
        }
        serviceListHtml += "</ul>";
        clauseBody = clauseBody.replace(/{{serviceList}}/g, serviceListHtml);

        pdfHtml += `<div class="pdf-clause"><h4>${clause.heading || ""}</h4><div>${clauseBody.replace(/\n/g, '<br>')}</div></div>`;
    });

    pdfHtml += `
            <div class="pdf-signatures">
                <div class="pdf-signature-block">
                    <p><strong>Participant</strong></p>
                    ${agreementInstanceData.participantSigUrl && agreementInstanceData.participantSigUrl !== "https://placehold.co/250x85?text=Signature" ? `<img src="${agreementInstanceData.participantSigUrl}" alt="Participant Signature">` : '<div style="width:150px; height:50px; border:1px dashed #ccc; margin: 0 auto 5mm; display:flex; align-items:center; justify-content:center; font-size:8pt; color:#999;">Signature Area</div>'}
                    <p>Date: ${agreementInstanceData.participantSignDate && agreementInstanceData.participantSignDate !== '___' ? agreementInstanceData.participantSignDate : '_____________________'}</p>
                </div>
                <div class="pdf-signature-block">
                    <p><strong>Support Worker</strong></p>
                     ${agreementInstanceData.workerSigUrl && agreementInstanceData.workerSigUrl !== "https://placehold.co/250x85?text=Signature" ? `<img src="${agreementInstanceData.workerSigUrl}" alt="Support Worker Signature">` : '<div style="width:150px; height:50px; border:1px dashed #ccc; margin: 0 auto 5mm; display:flex; align-items:center; justify-content:center; font-size:8pt; color:#999;">Signature Area</div>'}
                    <p>Date: ${agreementInstanceData.workerSignDate && agreementInstanceData.workerSignDate !== '___' ? agreementInstanceData.workerSignDate : '_____________________'}</p>
                </div>
            </div>
        </div>`;
    
    const tempDivAgreement = document.createElement("div");
    tempDivAgreement.innerHTML = pdfHtml;
    document.body.appendChild(tempDivAgreement);

    const opt = {
        margin: [15, 15, 15, 15], // mm
        filename: `ServiceAgreement-${workerName || 'User'}-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: -window.scrollY },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(tempDivAgreement).set(opt).save().then(() => {
        showMessage("PDF Generated", "Service Agreement PDF has been downloaded.");
        tempDivAgreement.remove();
    }).catch(err => {
        console.error("Error generating agreement PDF:", err);
        showMessage("PDF Error", "Could not generate PDF: " + err.message);
        tempDivAgreement.remove();
    });
}


function loadProfileData() { 
    if (!profile || !isFirebaseInitialized) return; 
    const profileNameEl = $("#profileName"); if (profileNameEl) profileNameEl.textContent = profile.name || "N/A";
    const profileAbnEl = $("#profileAbn"); if (profileAbnEl) profileAbnEl.textContent = profile.abn || "N/A";
    const profileGstEl = $("#profileGst"); if (profileGstEl) profileGstEl.textContent = profile.gstRegistered ? "Yes" : "No";
    const profileBsbEl = $("#profileBsb"); if (profileBsbEl) profileBsbEl.textContent = profile.bsb || "N/A"; 
    const profileAccEl = $("#profileAcc"); if (profileAccEl) profileAccEl.textContent = profile.acc || "N/A"; 
    
    const filesListUl = $("#profileFilesList");
    if (filesListUl) {
        if (profile.files && profile.files.length > 0) {
            filesListUl.innerHTML = "";
            profile.files.forEach(file => {
                const li = document.createElement('li');
                li.innerHTML = `<a href="${file.url || '#'}" target="_blank" title="${file.url ? 'Open file' : 'File URL not available'}">${file.name || 'Unnamed File'}</a> 
                                <button class="btn-danger btn-small" onclick="deleteProfileDocument('${file.name}', '${file.storagePath || ''}')" title="Delete ${file.name}"><i class="fas fa-trash-alt"></i></button>`;
                filesListUl.appendChild(li);
            });
        } else {
            filesListUl.innerHTML = "<li>No documents uploaded yet.</li>";
        }
    }
}
window.deleteProfileDocument = async function(fileName, storagePath) {
    if (!currentUserId || !fsDb) {
        showMessage("Error", "User not logged in or database not ready.");
        return;
    }
    if (!fileName) {
        showMessage("Error", "File name not provided for deletion.");
        return;
    }

    showMessage("Confirm Delete", 
        `Are you sure you want to delete the document "${fileName}"? This action cannot be undone.<br><br>
         <div class='modal-actions' style='justify-content: center; margin-top: 15px;'>
           <button onclick='_confirmDeleteProfileDocument("${fileName}", "${storagePath}")' class='btn-danger'><i class="fas fa-trash-alt"></i> Yes, Delete</button>
           <button class='btn-secondary' onclick='closeModal("messageModal")'><i class="fas fa-times"></i> No, Cancel</button>
         </div>`);
};

window._confirmDeleteProfileDocument = async function(fileName, storagePath) {
    closeModal("messageModal");
    showLoading("Deleting document...");
    console.warn(`Placeholder: File at path "${storagePath}" would be deleted from Firebase Storage here.`);

    try {
        const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        await updateDoc(userProfileDocRef, {
            files: arrayRemove(profile.files.find(f => f.name === fileName && f.storagePath === storagePath))
        });

        profile.files = profile.files.filter(f => !(f.name === fileName && f.storagePath === storagePath));
        loadProfileData(); 
        showMessage("Document Deleted", `Document "${fileName}" metadata removed from your profile.`);
    } catch (error) {
        console.error("Error deleting document metadata from Firestore:", error);
        showMessage("Error", "Could not delete document metadata: " + error.message);
    } finally {
        hideLoading();
    }
};


function enterPortal(isAdmin) { 
    if (isAdmin) { 
        setActive(location.hash || "#admin"); 
    } else { 
        if (globalSettings.portalType === 'organization' && (!profile.abn || !profile.bsb || !profile.acc || !profile.profileSetupComplete )) {
            openUserSetupWizard(); 
            return; 
        }
        setActive(location.hash || "#home"); 
    } 
    
    const homeUserDiv = $("#homeUser"); if (homeUserDiv) homeUserDiv.classList.remove('hide'); 
    const userNameDisplaySpan = $("#userNameDisplay"); 
    if (userNameDisplaySpan) userNameDisplaySpan.textContent = profile.name || (currentUserEmail ? currentUserEmail.split('@')[0] : "User"); 
}

function formatInvoiceNumber(num) {
    return `INV-${String(num).padStart(6, '0')}`;
}

async function handleInvoicePageLoad() { 
    const wkLblEl = $("#wkLbl"); if (wkLblEl) wkLblEl.textContent = new Date().getWeek(); 
    const invNoInput = $("#invNo"); 
    const invDateInput = $("#invDate"); if (invDateInput) invDateInput.value = new Date().toISOString().split('T')[0];
    
    const provNameInput = $("#provName"); 
    if (provNameInput) provNameInput.value = profile.name || (globalSettings.portalType === 'organization' ? globalSettings.organizationName : "") || "";
    
    const provAbnInput = $("#provAbn"); 
    if (provAbnInput) provAbnInput.value = profile.abn || (globalSettings.portalType === 'organization' ? globalSettings.organizationAbn : "") || "";
    
    const gstFlagInput = $("#gstFlag"); 
    const isGstRegistered = profile.gstRegistered !== undefined ? profile.gstRegistered : false; 
    if (gstFlagInput) gstFlagInput.value = isGstRegistered ? "Yes" : "No";
    
    const gstRowDiv = $("#gstRow"); 
    if (gstRowDiv) gstRowDiv.style.display = isGstRegistered ? "flex" : "none";

    if (!profile.nextInvoiceNumber && invNoInput) {
        const setInitialModal = $("#setInitialInvoiceModal");
        if (setInitialModal) {
            setInitialModal.style.display = "flex";
            $("#initialInvoiceNumberInput").value = 1001; 
        }
        invNoInput.value = ""; 
    } else if (invNoInput) {
        invNoInput.value = formatInvoiceNumber(profile.nextInvoiceNumber);
    }
    
    await loadDraftInvoice(); 
}

async function loadDraftInvoice() {
    const invTblBody = $("#invTbl tbody");
    if (!invTblBody || !currentUserId || !isFirebaseInitialized) {
        if (invTblBody) invTblBody.innerHTML = "<tr><td colspan='12' style='text-align:center;'>Error loading invoice data.</td></tr>";
        return;
    }
    
    showLoading("Loading invoice draft...");
    try {
        const draftInvoiceNumber = profile.nextInvoiceNumber ? formatInvoiceNumber(profile.nextInvoiceNumber) : 'current';
        const draftDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, `draft-${draftInvoiceNumber}`);
        const docSnap = await getDoc(draftDocRef);

        if (docSnap.exists()) {
            currentInvoiceData = docSnap.data();
            $("#invNo").value = currentInvoiceData.invoiceNumber || draftInvoiceNumber;
            $("#invDate").value = currentInvoiceData.invoiceDate || new Date().toISOString().split('T')[0];
            
            invTblBody.innerHTML = ""; 
            if (currentInvoiceData.items && currentInvoiceData.items.length > 0) {
                currentInvoiceData.items.forEach(item => addInvoiceRow(item, true)); 
            } else {
                addInvoiceRow(); 
            }
        } else {
            currentInvoiceData = { items: [], invoiceNumber: draftInvoiceNumber, invoiceDate: new Date().toISOString().split('T')[0], subtotal: 0, gst: 0, grandTotal: 0 };
            invTblBody.innerHTML = "";
            addInvoiceRow(); 
        }
    } catch (error) {
        console.error("Error loading invoice draft:", error);
        invTblBody.innerHTML = "<tr><td colspan='12' style='text-align:center;'>Could not load invoice draft.</td></tr>";
        currentInvoiceData = { items: [], invoiceNumber: profile.nextInvoiceNumber ? formatInvoiceNumber(profile.nextInvoiceNumber) : 'current', invoiceDate: new Date().toISOString().split('T')[0], subtotal: 0, gst: 0, grandTotal: 0 };
        addInvoiceRow();
    } finally {
        calculateInvoiceTotals();
        hideLoading();
    }
}


Date.prototype.getWeek = function() {
  var date = new Date(this.getTime());
   date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  var week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}


function openCustomTimePicker(inputElement, callbackFn) { 
    activeTimeInput = inputElement; 
    timePickerCallback = callbackFn; 
    const picker = $("#customTimePicker"); 
    if (picker) {
        picker.classList.remove('hide'); 
        picker.style.display = 'flex';  
        selectedAmPm = null; 
        selectedHour12 = null; 
        selectedMinute = null;
        $$('#timePickerAmPmButtons button, #timePickerHours button, #timePickerMinutes button').forEach(b => b.classList.remove('selected'));
        currentTimePickerStep = 'ampm'; 
        updateTimePickerStepView();
    } else {
        console.error("Custom time picker element (#customTimePicker) not found in HTML.");
        showMessage("UI Error", "Time picker component is missing. Please contact support.");
    }
}

function updateTimePickerStepView() { 
    const picker = $("#customTimePicker");
    if (!picker) return;

    const stepLabel = $("#currentTimePickerStepLabel");
    const ampmStepDiv = $("#timePickerStepAmPm");
    const hourStepDiv = $("#timePickerStepHour");
    const minuteStepDiv = $("#timePickerStepMinute");
    const backButton = $("#timePickerBackButton");
    const setButton = $("#setTimeButton");

    if (ampmStepDiv) ampmStepDiv.classList.add('hide');
    if (hourStepDiv) hourStepDiv.classList.add('hide');
    if (minuteStepDiv) minuteStepDiv.classList.add('hide');
    if (backButton) backButton.classList.add('hide');

    if (currentTimePickerStep === 'ampm') {
        if (stepLabel) stepLabel.textContent = "Select AM or PM";
        if (ampmStepDiv) {
            ampmStepDiv.classList.remove('hide');
            const ampmButtonsContainer = $("#timePickerAmPmButtons");
            if (ampmButtonsContainer) {
                ampmButtonsContainer.innerHTML = ''; 
                ['AM', 'PM'].forEach(val => {
                    const btn = document.createElement('button'); btn.textContent = val;
                    btn.onclick = () => { selectedAmPm = val; currentTimePickerStep = 'hour'; updateTimePickerStepView(); };
                    if (selectedAmPm === val) btn.classList.add('selected');
                    ampmButtonsContainer.appendChild(btn);
                });
            }
        }
    } else if (currentTimePickerStep === 'hour') {
        if (stepLabel) stepLabel.textContent = `Selected: ${selectedAmPm || ''} - Select Hour (1-12)`;
        if (hourStepDiv) {
            hourStepDiv.classList.remove('hide');
            const hoursContainer = $("#timePickerHours");
            if (hoursContainer) {
                hoursContainer.innerHTML = '';
                for (let i = 1; i <= 12; i++) {
                    const btn = document.createElement('button'); btn.textContent = i;
                    btn.onclick = () => { selectedHour12 = String(i).padStart(2,'0'); currentTimePickerStep = 'minute'; updateTimePickerStepView(); };
                    if (selectedHour12 === String(i).padStart(2,'0')) btn.classList.add('selected');
                    hoursContainer.appendChild(btn);
                }
            }
        }
        if (backButton) backButton.classList.remove('hide');
    } else if (currentTimePickerStep === 'minute') {
        if (stepLabel) stepLabel.textContent = `Selected: ${selectedHour12 || ''} ${selectedAmPm || ''} - Select Minute`;
        if (minuteStepDiv) {
            minuteStepDiv.classList.remove('hide');
            const minutesContainer = $("#timePickerMinutes");
            if (minutesContainer) {
                minutesContainer.innerHTML = '';
                ['00', '15', '30', '45'].forEach(val => { 
                    const btn = document.createElement('button'); btn.textContent = val;
                    btn.onclick = () => { selectedMinute = val; updateTimePickerStepView(); }; 
                    if (selectedMinute === val) btn.classList.add('selected');
                    minutesContainer.appendChild(btn);
                });
            }
        }
        if (backButton) backButton.classList.remove('hide');
    }
    if (setButton) setButton.disabled = !(selectedAmPm && selectedHour12 && selectedMinute);
}

async function logout() {
  if (!isFirebaseInitialized || !fbAuth) {
      showAuthStatusMessage("Logout Error: Authentication service not available.");
      if(authScreenElement) authScreenElement.style.display = "flex";
      if(portalAppElement) portalAppElement.style.display = "none";
      return;
  }
  try {
    showLoading("Logging out...");
    await fbSignOut(fbAuth); 
  } catch (e) {
    console.error("Logout failed:", e);
    showAuthStatusMessage("Logout Error: " + e.message); 
  } finally {
      hideLoading(); 
  }
}

window.saveAdminPortalSettings = async function() { 
    if (!isFirebaseInitialized || !(profile?.isAdmin)) {
        showMessage("Permission Denied", "You do not have permission to save portal settings.");
        return;
    }
    
    const portalTypeRadio = document.querySelector('input[name="adminWizPortalType"]:checked'); 
    const currentPortalType = portalTypeRadio ? portalTypeRadio.value : globalSettings.portalType;
    const orgNameVal = $("#adminEditOrgName")?.value.trim();
    const orgAbnVal = $("#adminEditOrgAbn")?.value.trim();
    const orgEmailVal = $("#adminEditOrgContactEmail")?.value.trim();
    const planManagerEmailVal = $("#adminEditPlanManagerEmail")?.value.trim();

    if (currentPortalType === "organization") {
        if (!orgNameVal) { return showMessage("Validation Error", "Organization Name is required.");}
        if (orgAbnVal && !isValidABN(orgAbnVal)) { return showMessage("Validation Error", "Invalid Organization ABN. Please enter an 11-digit ABN.");}
        if (orgEmailVal && !validateEmail(orgEmailVal)) { return showMessage("Validation Error", "Invalid Organization Contact Email format.");}
    }
    if (planManagerEmailVal && !validateEmail(planManagerEmailVal)) { return showMessage("Validation Error", "Invalid Plan Manager Email format.");}


    showLoading("Saving portal settings...");
    globalSettings.portalType = currentPortalType;

    if (currentPortalType === "organization") { 
        globalSettings.organizationName = orgNameVal || globalSettings.organizationName; 
        globalSettings.organizationAbn = orgAbnVal || globalSettings.organizationAbn; 
        globalSettings.organizationContactEmail = orgEmailVal || globalSettings.organizationContactEmail; 
        globalSettings.organizationContactPhone = $("#adminEditOrgContactPhone")?.value.trim() || globalSettings.organizationContactPhone; 
    } else { 
        globalSettings.organizationName = $("#adminEditParticipantName")?.value.trim() || globalSettings.participantName || "Participant Portal"; 
        globalSettings.organizationAbn = ""; 
        globalSettings.organizationContactEmail = ""; 
        globalSettings.organizationContactPhone = ""; 
    } 
    globalSettings.participantName = $("#adminEditParticipantName")?.value.trim() || globalSettings.participantName; 
    globalSettings.participantNdisNo = $("#adminEditParticipantNdisNo")?.value.trim() || globalSettings.participantNdisNo; 
    globalSettings.planManagerName = $("#adminEditPlanManagerName")?.value.trim() || globalSettings.planManagerName; 
    globalSettings.planManagerEmail = planManagerEmailVal || globalSettings.planManagerEmail; 
    globalSettings.planManagerPhone = $("#adminEditPlanManagerPhone")?.value.trim() || globalSettings.planManagerPhone; 
    globalSettings.planEndDate = $("#adminEditPlanEndDate")?.value || globalSettings.planEndDate; 
    globalSettings.agreementStartDate = globalSettings.agreementStartDate || new Date().toISOString().split('T')[0]; 
    globalSettings.setupComplete = true; 
    
    await saveGlobalSettingsToFirestore(); 
    hideLoading();
    showMessage("Settings Saved", "Global portal settings have been updated successfully."); 
    loadAdminPortalSettings(); 
    setActive(location.hash); 
};

window.resetGlobalSettingsToDefaults = function() { 
    if (!(profile?.isAdmin)) {
        showMessage("Permission Denied", "You do not have permission to reset settings.");
        return;
    }
    showMessage("Confirm Reset", 
        `Are you sure you want to reset all portal settings to their original defaults? This action cannot be undone.<br><br>
         <div class='modal-actions' style='justify-content: center; margin-top: 15px;'>
           <button onclick='_confirmResetGlobalSettingsFirestore()' class='btn-danger'><i class="fas fa-undo"></i> Yes, Reset</button>
           <button class='btn-secondary' onclick='closeModal("messageModal")'><i class="fas fa-times"></i> No, Cancel</button>
         </div>`);
};

window._confirmResetGlobalSettingsFirestore = async function() { 
    closeModal("messageModal");
    showLoading("Resetting portal settings...");
    globalSettings = await getDefaultGlobalSettingsFirestore(); 
    globalSettings.setupComplete = false; 
    await saveGlobalSettingsToFirestore(); 
    hideLoading();
    showMessage("Portal Reset", "All portal settings have been reset to their defaults. The admin may need to run the setup wizard again."); 
    
    if (location.hash === "#admin") {
        loadAdminPortalSettings(); 
        if (!globalSettings.setupComplete) {
            openAdminSetupWizard(); 
        }
    } else { 
        if (authScreenElement) authScreenElement.style.display = "flex";
        if (portalAppElement) portalAppElement.style.display = "none";
        if (profile && profile.isAdmin && !globalSettings.setupComplete) {
            openAdminSetupWizard();
        }
    }
};

window.saveAdminAgreementCustomizations = saveAdminAgreementCustomizationsToFirestore; 
window.clearAdminServiceForm = clearAdminServiceForm;

// ========== INVOICE SPECIFIC LOGIC ==========
let invoiceItemCounter = 0;

function addInvoiceRow(itemData = null, isLoadingFromDraft = false) {
    const tbody = $("#invTbl tbody");
    if (!tbody) return;

    if (tbody.rows.length === 1 && tbody.rows[0].cells.length === 1 && tbody.rows[0].cells[0].colSpan === 12) {
        tbody.innerHTML = "";
    }

    const rowIndex = invoiceItemCounter++;
    const tr = tbody.insertRow();

    tr.insertCell().textContent = tbody.rows.length; 

    const dateCell = tr.insertCell(); 
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.id = `itemDate${rowIndex}`;
    dateInput.className = 'invoice-input-condensed';
    dateInput.value = itemData?.date || new Date().toISOString().split('T')[0];
    dateInput.onchange = calculateInvoiceTotals;
    dateCell.appendChild(dateInput);

    const codeCellPrint = tr.insertCell(); 
    codeCellPrint.className = 'column-code print-only pdf-show';
    const codePrintSpan = document.createElement('span');
    codePrintSpan.id = `itemCodePrint${rowIndex}`;
    codePrintSpan.className = 'code-print-value';
    codePrintSpan.textContent = itemData?.serviceCode || "";
    codeCellPrint.appendChild(codePrintSpan);

    const descCell = tr.insertCell(); 
    const descSelect = document.createElement('select');
    descSelect.id = `itemDesc${rowIndex}`;
    descSelect.className = 'invoice-input-condensed description-select';
    descSelect.innerHTML = `<option value="">-- Select Service --</option>`;
    (profile.authorizedServiceCodes || []).forEach(code => {
        const service = adminManagedServices.find(s => s.code === code);
        if (service) {
            const opt = document.createElement('option');
            opt.value = service.code;
            opt.textContent = `${service.description} (${service.code})`;
            if (itemData?.serviceCode === service.code) opt.selected = true;
            descSelect.appendChild(opt);
        }
    });
    descCell.appendChild(descSelect);
    const descPrintSpan = document.createElement('span'); 
    descPrintSpan.id = `itemDescPrint${rowIndex}`;
    descPrintSpan.className = 'description-print-value'; 
    descPrintSpan.textContent = itemData?.description || (adminManagedServices.find(s=>s.code === itemData?.serviceCode)?.description || "");
    descCell.appendChild(descPrintSpan);


    const startCell = tr.insertCell(); 
    const startTimeInput = document.createElement('input');
    startTimeInput.type = 'text';
    startTimeInput.id = `itemStart${rowIndex}`;
    startTimeInput.className = 'custom-time-input invoice-input-condensed';
    startTimeInput.readOnly = true;
    startTimeInput.placeholder = "Select Time";
    startTimeInput.value = itemData?.startTime ? formatTime12Hour(itemData.startTime) : "";
    startTimeInput.dataset.value24 = itemData?.startTime || "";
    startTimeInput.onclick = () => openCustomTimePicker(startTimeInput, () => {
        if (rateTypePrintSpan) rateTypePrintSpan.textContent = determineRateType(dateInput.value, startTimeInput.dataset.value24);
        calculateInvoiceTotals();
    });
    startCell.appendChild(startTimeInput);

    const endCell = tr.insertCell(); 
    const endTimeInput = document.createElement('input');
    endTimeInput.type = 'text';
    endTimeInput.id = `itemEnd${rowIndex}`;
    endTimeInput.className = 'custom-time-input invoice-input-condensed';
    endTimeInput.readOnly = true;
    endTimeInput.placeholder = "Select Time";
    endTimeInput.value = itemData?.endTime ? formatTime12Hour(itemData.endTime) : "";
    endTimeInput.dataset.value24 = itemData?.endTime || "";
    endTimeInput.onclick = () => openCustomTimePicker(endTimeInput, calculateInvoiceTotals);
    endCell.appendChild(endTimeInput);

    const rateTypeCellPrint = tr.insertCell(); 
    rateTypeCellPrint.className = 'column-rate-type print-only pdf-show';
    const rateTypePrintSpan = document.createElement('span');
    rateTypePrintSpan.id = `itemRateTypePrint${rowIndex}`;
    rateTypePrintSpan.className = 'rate-type-print-value';
    rateTypePrintSpan.textContent = itemData?.rateType || determineRateType(dateInput.value, startTimeInput.dataset.value24);
    rateTypeCellPrint.appendChild(rateTypePrintSpan);

    const rateUnitCellPrint = tr.insertCell(); 
    rateUnitCellPrint.className = 'print-only-column pdf-show';
    rateUnitCellPrint.id = `itemRateUnitPrint${rowIndex}`;
    rateUnitCellPrint.textContent = "$0.00"; 
    
    descSelect.onchange = (e) => { 
        const selectedService = adminManagedServices.find(s => s.code === e.target.value);
        if(codePrintSpan) codePrintSpan.textContent = selectedService ? selectedService.code : "";
        if(descPrintSpan) descPrintSpan.textContent = selectedService ? selectedService.description : "N/A";
        const rt = determineRateType(dateInput.value, startTimeInput.dataset.value24);
        if(rateTypePrintSpan) rateTypePrintSpan.textContent = rt;
        
        let rateForPrintOnChange = 0;
        if(selectedService) {
            if (selectedService.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) {
                rateForPrintOnChange = selectedService.rates?.perKmRate || 0;
            } else if (selectedService.categoryType === SERVICE_CATEGORY_TYPES.CORE_STANDARD || selectedService.categoryType === SERVICE_CATEGORY_TYPES.CORE_HIGH_INTENSITY) {
                rateForPrintOnChange = selectedService.rates?.[rt] || selectedService.rates?.weekday || 0;
            } else if (selectedService.categoryType === SERVICE_CATEGORY_TYPES.CAPACITY_THERAPY_STD || selectedService.categoryType === SERVICE_CATEGORY_TYPES.CAPACITY_SPECIALIST || selectedService.categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
                rateForPrintOnChange = selectedService.rates?.standardRate || 0;
            }
        }
        if(rateUnitCellPrint) rateUnitCellPrint.textContent = `$${parseFloat(rateForPrintOnChange).toFixed(2)}`;
        
        travelKmInput.style.display = (selectedService && selectedService.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) ? 'block' : 'none';
        if (selectedService && selectedService.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM) travelKmInput.value = "";
        claimTravelLabel.style.display = (selectedService && selectedService.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) ? 'none' : 'flex';
        if (selectedService && selectedService.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) claimTravelCheckbox.checked = false;

        calculateInvoiceTotals();
    };


    const hoursKmCell = tr.insertCell(); 
    hoursKmCell.id = `itemHoursKm${rowIndex}`;
    hoursKmCell.textContent = itemData?.hoursOrKm?.toFixed(2) || "0.00";

    const travelInputCell = tr.insertCell(); 
    travelInputCell.className = 'no-print pdf-hide';
    const travelKmInput = document.createElement('input');
    travelKmInput.type = 'number';
    travelKmInput.id = `itemTravel${rowIndex}`;
    travelKmInput.className = 'invoice-input-condensed';
    travelKmInput.placeholder = "Km";
    travelKmInput.step = "0.1";
    travelKmInput.min = "0";
    travelKmInput.value = itemData?.travelKmInput || "";
    travelKmInput.oninput = calculateInvoiceTotals;
    travelInputCell.appendChild(travelKmInput);
    const initialServiceForTravel = adminManagedServices.find(s => s.code === descSelect.value);
    travelKmInput.style.display = (initialServiceForTravel && initialServiceForTravel.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) ? 'block' : 'none';
    
    const claimTravelCell = tr.insertCell(); 
    claimTravelCell.className = 'no-print pdf-hide';
    const claimTravelLabel = document.createElement('label');
    claimTravelLabel.className = 'chk no-margin km-claim-toggle';
    const claimTravelCheckbox = document.createElement('input');
    claimTravelCheckbox.type = 'checkbox';
    claimTravelCheckbox.id = `itemClaimTravel${rowIndex}`;
    claimTravelCheckbox.checked = itemData?.claimTravel || false;
    claimTravelCheckbox.onchange = calculateInvoiceTotals;
    claimTravelLabel.appendChild(claimTravelCheckbox);
    claimTravelLabel.appendChild(document.createTextNode(" Claim"));
    claimTravelCell.appendChild(claimTravelLabel);
    claimTravelLabel.style.display = (initialServiceForTravel && initialServiceForTravel.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) ? 'none' : 'flex';

    const totalCell = tr.insertCell(); 
    totalCell.id = `itemTotal${rowIndex}`;
    totalCell.textContent = itemData?.total ? `$${itemData.total.toFixed(2)}` : "$0.00";

    const actionsCell = tr.insertCell(); 
    actionsCell.className = 'no-print pdf-hide';
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteBtn.className = 'btn-danger btn-small delete-row-btn';
    deleteBtn.title = "Delete Row";
    deleteBtn.onclick = () => {
        tr.remove();
        $$("#invTbl tbody tr").forEach((r, idx) => { r.cells[0].textContent = idx + 1; });
        calculateInvoiceTotals();
    };
    actionsCell.appendChild(deleteBtn);

    if (isLoadingFromDraft && itemData) { 
        if (codePrintSpan) codePrintSpan.textContent = itemData.serviceCode || "";
        if (descPrintSpan) descPrintSpan.textContent = itemData.description || "";
        if (rateTypePrintSpan) rateTypePrintSpan.textContent = itemData.rateType || "";
    } else { 
         if (codePrintSpan && descSelect.value) codePrintSpan.textContent = descSelect.value;
         if (descPrintSpan && descSelect.options[descSelect.selectedIndex]) descPrintSpan.textContent = descSelect.options[descSelect.selectedIndex].text.split(' (')[0];
         if (rateTypePrintSpan) rateTypePrintSpan.textContent = determineRateType(dateInput.value, startTimeInput.dataset.value24);
    }
    
    calculateInvoiceTotals(); 
}


function calculateInvoiceTotals() {
    let subtotal = 0;
    const rows = $$("#invTbl tbody tr");

    rows.forEach((row) => { 
        const dateInput = row.querySelector(`input[id^="itemDate"]`);
        const descSelect = row.querySelector(`select[id^="itemDesc"]`);
        const startTimeInput = row.querySelector(`input[id^="itemStart"]`);
        const endTimeInput = row.querySelector(`input[id^="itemEnd"]`);
        const travelKmInput = row.querySelector(`input[id^="itemTravel"]`);
        const claimTravelCheckbox = row.querySelector(`input[id^="itemClaimTravel"]`);
        
        const hoursKmCell = row.cells[8]; 
        const totalCell = row.cells[10];  
        const rateUnitPrintCell = row.cells[7]; 

        const serviceCode = descSelect?.value;
        const service = adminManagedServices.find(s => s.code === serviceCode);
        let itemTotal = 0;
        let hours = 0;
        let km = 0;
        let rateForPrint = 0;

        if (service) {
            const itemDate = dateInput?.value;
            const startTime = startTimeInput?.dataset.value24;
            const endTime = endTimeInput?.dataset.value24;
            
            const descPrintSpan = row.querySelector(`span[id^="itemDescPrint"]`);
            if(descPrintSpan) descPrintSpan.textContent = service.description;
            const codePrintSpan = row.querySelector(`span[id^="itemCodePrint"]`);
            if(codePrintSpan) codePrintSpan.textContent = service.code;
            const rateTypePrintSpan = row.querySelector(`span[id^="itemRateTypePrint"]`);


            if (service.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) {
                km = parseFloat(travelKmInput?.value) || 0;
                hoursKmCell.textContent = km.toFixed(2);
                const rate = service.rates?.perKmRate || 0;
                itemTotal = km * rate;
                rateForPrint = rate;
                if(rateTypePrintSpan) rateTypePrintSpan.textContent = "Travel"; 
            } else { 
                hours = calculateHours(startTime, endTime);
                hoursKmCell.textContent = hours.toFixed(2);
                
                const rateType = determineRateType(itemDate, startTime);
                if(rateTypePrintSpan) rateTypePrintSpan.textContent = rateType;

                if (service.categoryType === SERVICE_CATEGORY_TYPES.CORE_STANDARD || service.categoryType === SERVICE_CATEGORY_TYPES.CORE_HIGH_INTENSITY) {
                    rateForPrint = service.rates?.[rateType] || service.rates?.weekday || 0;
                } else if (service.categoryType === SERVICE_CATEGORY_TYPES.CAPACITY_THERAPY_STD || service.categoryType === SERVICE_CATEGORY_TYPES.CAPACITY_SPECIALIST || service.categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
                    rateForPrint = service.rates?.standardRate || 0;
                }
                itemTotal = hours * rateForPrint;

                if (claimTravelCheckbox?.checked && service.travelCode) {
                    const travelService = adminManagedServices.find(ts => ts.code === service.travelCode && ts.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM);
                    const travelKmForThisService = parseFloat(travelKmInput?.value) || 0; 
                    if (travelService && travelKmForThisService > 0) {
                        const travelRate = travelService.rates?.perKmRate || 0;
                        itemTotal += travelKmForThisService * travelRate;
                    }
                }
            }
        }
        totalCell.textContent = `$${itemTotal.toFixed(2)}`;
        if(rateUnitPrintCell) rateUnitPrintCell.textContent = `$${parseFloat(rateForPrint).toFixed(2)}`;
        subtotal += itemTotal;
    });

    $("#sub").textContent = `$${subtotal.toFixed(2)}`;
    let gstAmount = 0;
    if (profile.gstRegistered) {
        gstAmount = subtotal * 0.10;
        $("#gst").textContent = `$${gstAmount.toFixed(2)}`;
        $("#gstRow").style.display = 'flex';
    } else {
        $("#gst").textContent = "$0.00";
        $("#gstRow").style.display = 'none';
    }
    $("#grand").textContent = `$${(subtotal + gstAmount).toFixed(2)}`;
}

