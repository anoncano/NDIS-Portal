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
    runTransaction
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* ========== DOM helpers ========== */
const $ = q => document.querySelector(q);
const $$ = q => [...document.querySelectorAll(q)];

/* ========== Firebase Global Variables & Config ========== */
let fbApp;
let fbAuth;
let fsDb; 
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
function determineRateType(dateStr, startTime24) { if (!dateStr || !startTime24) return "weekday"; const date = new Date(dateStr); const day = date.getDay(); const hr = parseInt(startTime24.split(':')[0],10); if (day === 0) return "sunday"; if (day === 6) return "saturday"; if (hr >= 20) return "evening"; if (hr < 6) return "night"; return "weekday"; }
function formatTime12Hour(t24){if(!t24)return"";const [h,m]=t24.split(':'),hr=parseInt(h,10);if(isNaN(hr)||isNaN(parseInt(m,10)))return"";const ap=hr>=12?'PM':'AM';let hr12=hr%12;hr12=hr12?hr12:12;return`${String(hr12).padStart(2,'0')}:${m} ${ap}`;}

/* ========== Firebase Initialization and Auth State ========== */
async function initializeFirebase() {
    if (!firebaseConfig || 
        !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_") ||
        !firebaseConfig.authDomain || 
        !firebaseConfig.projectId || 
        !firebaseConfig.storageBucket || 
        !firebaseConfig.messagingSenderId || 
        !firebaseConfig.appId || firebaseConfig.appId.startsWith("YOUR_") || firebaseConfig.appId === "") {
        console.error("Firebase configuration is missing or incomplete.");
        if (authScreenElement) authScreenElement.style.display = "flex";
        if (portalAppElement) portalAppElement.style.display = "none";
        showAuthStatusMessage("System Error: Portal configuration is invalid. Cannot connect.");
        hideLoading(); 
        isFirebaseInitialized = false; 
        return; 
    }

    try {
        fbApp = initializeApp(firebaseConfig);
        fbAuth = getAuth(fbApp);
        fsDb = getFirestore(fbApp); 

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
                        profile = { name: currentUserEmail.split('@')[0], email: currentUserEmail, uid: currentUserId, isAdmin: false, createdAt: serverTimestamp(), abn: "", gstRegistered: false, bsb: "", acc: "", files: [], authorizedServiceCodes: [], profileSetupComplete: false };
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

window.editProfile = function() { console.warn("editProfile function placeholder triggered."); showMessage("Coming Soon", "Profile editing will be available here."); };
window.uploadProfileDocuments = function() { console.warn("uploadProfileDocuments function placeholder triggered."); showMessage("Coming Soon", "Document uploading will be available here."); };
window.addInvRowUserAction = function() { console.warn("addInvRowUserAction function placeholder triggered."); showMessage("Information", "Adding invoice row manually.");};
window.saveDraft = function() { console.warn("saveDraft function placeholder triggered."); showMessage("Information", "Invoice draft saving placeholder.");};
window.generateInvoicePdf = function() { console.warn("generateInvoicePdf function placeholder triggered."); showMessage("Information", "PDF generation placeholder.");};
window.saveSig = function() { console.warn("saveSig function placeholder triggered."); showMessage("Information", "Signature saving placeholder."); closeModal('sigModal');};

function openUserSetupWizard() {
    const wizModal = $("#wiz");
    if (wizModal) {
        userWizStep = 1;
        updateUserWizardView(); 
        if ($("#wName") && profile && profile.name) $("#wName").value = profile.name;
        if ($("#wAbn") && profile && profile.abn) $("#wAbn").value = profile.abn;
        if ($("#wGst") && profile && profile.gstRegistered !== undefined) $("#wGst").checked = profile.gstRegistered;
        if ($("#wBsb") && profile && profile.bsb) $("#wBsb").value = profile.bsb;
        if ($("#wAcc") && profile && profile.acc) $("#wAcc").value = profile.acc;
        
        wizModal.classList.remove('hide');
        wizModal.style.display = "flex";
        showMessage("Welcome!", "Please complete your profile setup to continue.");
    }
}

function updateUserWizardView() {
    $$("#wiz .wizard-step-content").forEach(el => el.classList.add('hide'));
    $$("#wiz .wizard-step-indicator").forEach(el => el.classList.remove('active'));

    const currentStepContent = $(`#wStep${userWizStep}`);
    const currentStepIndicator = $(`#wizStepIndicator${userWizStep}`);

    if (currentStepContent) currentStepContent.classList.remove('hide');
    if (currentStepIndicator) currentStepIndicator.classList.add('active');
    
    const wHead = $("#wHead");
    if (wHead) {
        if (userWizStep === 1) wHead.textContent = "Step 1: Basic Info";
        else if (userWizStep === 2) wHead.textContent = "Step 2: Bank Details";
        else if (userWizStep === 3) wHead.textContent = "Step 3: Docs (Optional)";
        else if (userWizStep === 4) wHead.textContent = "Step 4: All Done!";
    }
}

window.wizNext = function() {
    if (userWizStep === 1) {
        const name = $("#wName")?.value.trim();
        const abn = $("#wAbn")?.value.trim();
        if (!name) { return showMessage("Validation Error", "Full name is required."); }
        if (!abn) { return showMessage("Validation Error", "ABN is required."); }
    } else if (userWizStep === 2) {
        const bsb = $("#wBsb")?.value.trim();
        const acc = $("#wAcc")?.value.trim();
        if (!bsb) { return showMessage("Validation Error", "BSB is required."); }
        if (!acc) { return showMessage("Validation Error", "Account number is required."); }
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
    showLoading("Saving profile...");

    const profileUpdates = {
        name: $("#wName")?.value.trim() || profile.name || "",
        abn: $("#wAbn")?.value.trim() || profile.abn || "",
        gstRegistered: $("#wGst")?.checked || false,
        bsb: $("#wBsb")?.value.trim() || profile.bsb || "",
        acc: $("#wAcc")?.value.trim() || profile.acc || "",
        profileSetupComplete: true, 
        lastUpdated: serverTimestamp()
    };

    if (!profileUpdates.name) { hideLoading(); return showMessage("Validation Error", "Full name is required to finish setup."); }
    if (!profileUpdates.abn) { hideLoading(); return showMessage("Validation Error", "ABN is required to finish setup."); }
    if (!profileUpdates.bsb) { hideLoading(); return showMessage("Validation Error", "BSB is required to finish setup."); }
    if (!profileUpdates.acc) { hideLoading(); return showMessage("Validation Error", "Account number is required to finish setup."); }

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
        enterPortal(false); 
        if(location.hash === "#profile") loadProfileData(); 

    } catch (error) {
        hideLoading();
        console.error("Error saving profile from wizard:", error);
        showMessage("Storage Error", "Could not save your profile details: " + error.message);
    }
};

window.saveRequest = function() { console.warn("saveRequest function placeholder triggered."); showMessage("Information", "Shift request saving placeholder."); closeModal('rqModal');};
window.saveInitialInvoiceNumber = function() { console.warn("saveInitialInvoiceNumber function placeholder triggered."); showMessage("Information", "Initial invoice number saving placeholder."); closeModal('setInitialInvoiceModal');};
window.saveShiftFromModalToInvoice = function() { console.warn("saveShiftFromModalToInvoice function placeholder triggered."); showMessage("Information", "Saving shift to invoice placeholder."); closeModal('logShiftModal');};

// --- Admin Setup Wizard (#adminSetupWizard) Functions ---
function openAdminSetupWizard() { 
    const modal = $("#adminSetupWizard"); 
    if(modal) { 
        adminWizStep = 1; 
        // Pre-fill Step 1 radio based on current globalSettings if they exist
        const currentPortalType = globalSettings.portalType || 'organization';
        const portalTypeRadio = $(`input[name="adminWizPortalType"][value="${currentPortalType}"]`);
        if (portalTypeRadio) portalTypeRadio.checked = true;

        updateAdminWizardView(); // This will show/hide fields based on the (potentially pre-filled) radio
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

    // Pre-fill fields based on globalSettings if available (especially when navigating back/forth)
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
        } else { // participant
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
    // No specific validation here, validation happens on finish or can be added per step
    if (adminWizStep === 1) {
        // Update view for step 2 based on selection
        updateAdminWizardView(); // Call to ensure step 2 fields are correctly shown/hidden
    } else if (adminWizStep === 2) {
        const portalType = document.querySelector('input[name="adminWizPortalType"]:checked')?.value;
        if (portalType === 'organization') {
            if (!$("#adminWizOrgName")?.value.trim()) {
                showMessage("Validation Error", "Organization Name is required for 'Organization' type.");
                return;
            }
        } else { // participant
            if (!$("#adminWizUserName")?.value.trim()) {
                showMessage("Validation Error", "Your Name is required for 'Self-Managed Participant' type.");
                return;
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
    showLoading("Finalizing portal setup...");

    const portalTypeSelected = document.querySelector('input[name="adminWizPortalType"]:checked')?.value;
    if (!portalTypeSelected) {
        hideLoading();
        showMessage("Validation Error", "Please select a Portal Type in Step 1.");
        adminWizStep = 1; // Go back to step 1
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
        // Preserve existing rateMultipliers and agreementStartDate if they exist
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
            hideLoading();
            showMessage("Validation Error", "Organization Name is required for 'Organization' type (Step 2).");
            adminWizStep = 2; updateAdminWizardView(); return;
        }
    } else { // participant
        tempGlobalSettings.adminUserName = $("#adminWizUserName")?.value.trim();
        tempGlobalSettings.organizationName = tempGlobalSettings.adminUserName || profile.name || "Participant Portal"; // Portal name is admin's name
        
        if (!tempGlobalSettings.adminUserName) {
            hideLoading();
            showMessage("Validation Error", "Your Name is required for 'Self-Managed Participant' type (Step 2).");
            adminWizStep = 2; updateAdminWizardView(); return;
        }
        // For participant type, the main participant is the admin themselves.
        // Update their name in their own profile if it changed in the wizard.
        if (profile.uid === currentUserId && tempGlobalSettings.adminUserName !== profile.name) {
            const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
            try {
                await updateDoc(userProfileDocRef, { name: tempGlobalSettings.adminUserName });
                profile.name = tempGlobalSettings.adminUserName; 
            } catch (e) { console.error("Error updating admin's name during participant setup:", e); }
        }
         // Participant details from step 3 become the primary participant info
        tempGlobalSettings.participantName = tempGlobalSettings.adminUserName; // Participant name is the admin's name
    }
    
    if (!tempGlobalSettings.participantName && portalTypeSelected === 'organization') { // For org, default participant name is required
        hideLoading(); 
        showMessage("Validation Error", "Default Participant Name is required (Step 3).");
        adminWizStep = 3; updateAdminWizardView(); return;
    }
     if (!tempGlobalSettings.participantName && portalTypeSelected === 'participant') { // For self-managed, this comes from admin's name
        tempGlobalSettings.participantName = tempGlobalSettings.adminUserName;
    }


    globalSettings = { ...globalSettings, ...tempGlobalSettings }; 

    try {
        await saveGlobalSettingsToFirestore(); // This saves the merged globalSettings
        hideLoading();
        closeModal('adminSetupWizard');
        showMessage("Setup Complete", "Portal has been configured successfully.");
        enterPortal(true); 
        if(location.hash === "#admin") {
            loadAdminPortalSettings(); // Refresh admin settings page to show new values
            setActive("#admin"); // Ensure admin page remains active and title updates
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
    if (!isFirebaseInitialized || !(profile && profile.isAdmin)) return;
    try {
        const usersBaseCollectionRef = collection(fsDb, `artifacts/${appId}/users`);
        const usersSnapshot = await getDocs(usersBaseCollectionRef);
        
        accounts = {}; 
        const profilePromises = [];

        usersSnapshot.forEach((userDoc) => {
            const userId = userDoc.id;
            const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${userId}/profile`, "details");
            profilePromises.push(getDoc(userProfileDocRef).then(profileSnap => {
                if (profileSnap.exists()) {
                    const userData = profileSnap.data();
                     if (userData.email && userData.email.toLowerCase() !== "admin@portal.com") { 
                        accounts[userData.email] = { name: userData.name || 'Unnamed User', profile: { uid: userId, ...userData } };
                    } else if (userData.isAdmin && !userData.email) { 
                        accounts[userId] = { name: userData.name || 'Admin User', profile: { uid: userId, ...userData}};
                    }
                }
            }));
        });
        await Promise.all(profilePromises); 

        if(location.hash === "#agreement" && $("#adminAgreementWorkerSelector")) populateAdminWorkerSelectorForAgreement();
        if(location.hash === "#admin" && $(".admin-tab-btn.active")?.dataset.target === "adminWorkerManagement") displayWorkersForAuth(); 
    } catch (error) { 
        console.error("Error loading user accounts for admin from Firestore:", error); 
        showMessage("Data Error", "Could not load worker accounts for admin."); 
    }
}

function displayWorkersForAuth() {
    const ul = $("#workersListForAuth"); if (!ul) return; ul.innerHTML = ""; 
    const workerAccounts = Object.entries(accounts).filter(([key, acc]) => acc && acc.profile && !acc.profile.isAdmin);
    
    if (workerAccounts.length === 0) { 
        ul.innerHTML = "<li>No workers found to authorize.</li>"; 
        const selectedWorkerNameEl = $("#selectedWorkerNameForAuth");
        if (selectedWorkerNameEl) selectedWorkerNameEl.textContent = "Select a Worker";
        const servicesContainerEl = $("#servicesForWorkerContainer");
        if (servicesContainerEl) servicesContainerEl.classList.add("hide");
        return; 
    }
    workerAccounts.forEach(([key, worker]) => { 
        const displayIdentifier = worker.profile.email || key; 
        const li = document.createElement("li"); 
        li.innerHTML = `<i class="fas fa-user-tie"></i> ${worker.profile.name || 'Unnamed Worker'} <small>(${displayIdentifier})</small>`; 
        li.dataset.key = key; 
        li.onclick = () => selectWorkerForAuth(key); 
        ul.appendChild(li); 
    });
}

function selectWorkerForAuth(key) { 
    selectedWorkerEmailForAuth = key; 
    const worker = accounts[selectedWorkerEmailForAuth]; 
    const nameEl = $("#selectedWorkerNameForAuth");
    const containerEl = $("#servicesForWorkerContainer");

    if (!worker || !worker.profile) { 
        showMessage("Error", "Selected worker data not found."); 
        if(nameEl) nameEl.textContent = "Error loading worker"; 
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
        if (service.isActiveInAgreement && service.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM) { 
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
        ul.innerHTML = "<li>No suitable (non-travel, active) NDIS services defined for authorization.</li>";
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
          // For participant type, the portal name might be the participant's name (which is also admin's name)
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
        console.warn("Agreement PDF generation placeholder triggered.");
        showMessage("Coming Soon", "Service Agreement PDF generation will be implemented here.");
    });

    const inviteLinkElement = $("#invite");
    if (inviteLinkElement) inviteLinkElement.textContent=`${location.origin}${location.pathname}#register`; 

    const wizardFilesInput = $("#wFiles");
    if (wizardFilesInput) wizardFilesInput.addEventListener('change', displayUploadedFilesWizard); 
    
    const requestShiftBtn = $("#rqBtn");
    if (requestShiftBtn) requestShiftBtn.addEventListener('click', () => { 
        const rqModalEl = $("#rqModal"); if (rqModalEl) rqModalEl.style.display = "flex";
    });

    const logShiftBtn = $("#logTodayShiftBtn");
    if (logShiftBtn) logShiftBtn.addEventListener('click', openLogShiftModal);
    
    const signAgreementBtn = $("#signBtn"); 
    if (signAgreementBtn) signAgreementBtn.addEventListener('click', async () => { 
        signingAs = 'worker'; 
        const sigModalEl = $("#sigModal"); if (sigModalEl) sigModalEl.style.display = "flex";
    });

    const participantSignBtnEl = $("#participantSignBtn"); 
    if (participantSignBtnEl) participantSignBtnEl.addEventListener('click', async () => { 
        signingAs = 'participant'; 
        const sigModalEl = $("#sigModal"); if (sigModalEl) sigModalEl.style.display = "flex";
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
        
        const shiftRequestsContainer = $("#shiftRequestsContainer");
        if(shiftRequestsContainer) {
            // Placeholder: Actual data loading for shift requests needed
            // shiftRequestsContainer.classList.remove('hide'); 
            // const rqTblBody = $("#rqTbl tbody");
            // if(rqTblBody) rqTblBody.innerHTML = "<tr><td colspan='5'>No shift requests (placeholder).</td></tr>";
        }

    } else {
        const homeUserDiv = $("#homeUser");
        if (homeUserDiv) homeUserDiv.classList.add('hide');
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
            } else if (adminManagedServices.length === 0) {
                 supportTypeSelect.innerHTML = "<option value=''>No services defined by admin</option>";
            } else {
                 supportTypeSelect.innerHTML = "<option value=''>No services authorized or available</option>";
            }
        }
        
        const startTimeInput = $("#logShiftStartTime"); if (startTimeInput) { startTimeInput.value = ""; startTimeInput.dataset.value24 = "";}
        const endTimeInput = $("#logShiftEndTime"); if (endTimeInput) { endTimeInput.value = ""; endTimeInput.dataset.value24 = "";}
        
        const claimTravelToggle = $("#logShiftClaimTravelToggle"); if (claimTravelToggle) claimTravelToggle.checked = false;
        const kmFieldsContainer = $("#logShiftKmFieldsContainer"); if (kmFieldsContainer) kmFieldsContainer.classList.add('hide');
        const startKmInput = $("#logShiftStartKm"); if (startKmInput) startKmInput.value = "";
        const endKmInput = $("#logShiftEndKm"); if (endKmInput) endKmInput.value = "";
        const calculatedKmSpan = $("#logShiftCalculatedKm"); if (calculatedKmSpan) calculatedKmSpan.textContent = "0.0 Km";

        logShiftModalEl.style.display = "flex";
    } else {
        showMessage("Error", "Log shift modal element not found.");
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
        $("#agreementContentContainer").innerHTML = "<p><em>Error: Agreement template data is missing.</em></p>";
        return;
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

    let agreementInstanceData = { workerSigned: false, participantSigned: false, workerSigUrl: null, participantSigUrl: null, workerSignDate: null, participantSignDate: null };
    try {
        const agreementInstanceRef = doc(fsDb, agreementDocPath);
        const agreementInstanceSnap = await getDoc(agreementInstanceRef);
        if (agreementInstanceSnap.exists()) {
            agreementInstanceData = { ...agreementInstanceData, ...agreementInstanceSnap.data() };
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
                               .replace(/{{agreementStartDate}}/g, agreementInstanceData.agreementStartDate || globalSettings.agreementStartDate || "[Start Date]") 
                               .replace(/{{agreementEndDate}}/g, globalSettings.planEndDate || "[End Date]"); 

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
    if (agreementInstanceData.participantSignDate && dPEl) dPEl.textContent = formatDateForInvoiceDisplay(agreementInstanceData.participantSignDate); else if (dPEl) dPEl.textContent = "___";
    
    if (agreementInstanceData.workerSigUrl && sigWImg) sigWImg.src = agreementInstanceData.workerSigUrl; else if (sigWImg) sigWImg.src = "";
    if (agreementInstanceData.workerSignDate && dWEl) dWEl.textContent = formatDateForInvoiceDisplay(agreementInstanceData.workerSignDate); else if (dWEl) dWEl.textContent = "___";

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
            if (agreementInstanceData.workerSigned && signBtnEl) signBtnEl.classList.add("hide");
            if (participantSignBtnEl) participantSignBtnEl.classList.add("hide"); 
        } else { 
            if (agreementInstanceData.participantSigned && participantSignBtnEl) participantSignBtnEl.classList.add("hide");
            if (signBtnEl) signBtnEl.classList.add("hide"); 
        }
    }
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
                li.innerHTML = `<a href="${file.url || '#'}" target="_blank">${file.name || 'Unnamed File'}</a> 
                                <button class="btn-danger btn-small" onclick="deleteProfileDocument('${file.name}')" title="Delete ${file.name}"><i class="fas fa-trash-alt"></i></button>`;
                filesListUl.appendChild(li);
            });
        } else {
            filesListUl.innerHTML = "<li>No documents uploaded yet.</li>";
        }
    }
}
window.deleteProfileDocument = function(fileName) {
    console.warn(`deleteProfileDocument placeholder for: ${fileName}`);
    showMessage("Coming Soon", `Deletion for ${fileName} is not yet implemented.`);
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

function handleInvoicePageLoad() { 
    const wkLblEl = $("#wkLbl"); if (wkLblEl) wkLblEl.textContent = new Date().getWeek(); 
    const invNoInput = $("#invNo"); if (invNoInput) invNoInput.value = profile.nextInvoiceNumber || "INV-001"; 
    const invDateInput = $("#invDate"); if (invDateInput) invDateInput.value = new Date().toISOString().split('T')[0];
    
    const provNameInput = $("#provName"); 
    if (provNameInput) provNameInput.value = profile.name || (globalSettings.portalType === 'organization' ? globalSettings.organizationName : "") || "";
    
    const provAbnInput = $("#provAbn"); 
    if (provAbnInput) provAbnInput.value = profile.abn || (globalSettings.portalType === 'organization' ? globalSettings.organizationAbn : "") || "";
    
    const gstFlagInput = $("#gstFlag"); 
    const isGstRegistered = profile.gstRegistered !== undefined ? profile.gstRegistered : false; 
    if (gstFlagInput) gstFlagInput.value = isGstRegistered ? "Yes" : "No";
    
    const gstRowDiv = $("#gstRow"); 
    if (gstRowDiv) gstRowDiv.style.display = isGstRegistered ? "flex" : "none"; // Use flex for totals alignment

    const invTblBody = $("#invTbl tbody");
    if (invTblBody) invTblBody.innerHTML = "<tr><td colspan='12' style='text-align:center;'>No services added yet. (Placeholder)</td></tr>";
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
        console.error("Custom time picker element not found.");
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
    showLoading("Saving portal settings...");
    
    const portalTypeRadio = document.querySelector('input[name="adminWizPortalType"]:checked'); 
    const currentPortalType = portalTypeRadio ? portalTypeRadio.value : globalSettings.portalType;

    globalSettings.portalType = currentPortalType;

    if (currentPortalType === "organization") { 
        globalSettings.organizationName = $("#adminEditOrgName")?.value.trim() || globalSettings.organizationName; 
        globalSettings.organizationAbn = $("#adminEditOrgAbn")?.value.trim() || globalSettings.organizationAbn; 
        globalSettings.organizationContactEmail = $("#adminEditOrgContactEmail")?.value.trim() || globalSettings.organizationContactEmail; 
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
    globalSettings.planManagerEmail = $("#adminEditPlanManagerEmail")?.value.trim() || globalSettings.planManagerEmail; 
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

