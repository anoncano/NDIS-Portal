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
    arrayRemove,
    addDoc as fsAddDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// --- Start of Firebase Configuration ---
// This firebaseConfig will be used by the script.
// It's populated with values from your Firebase project.
// If __firebase_config is provided by the Canvas environment, it will override this.
window.firebaseConfigForApp = {
    // SECURITY NOTE: Hardcoding API keys directly in client-side code can be a security risk.
    // It's generally recommended to use environment variables or a backend service to handle API keys.
    // The __firebase_config variable (if provided by the Canvas environment) is a safer way to inject this.
    apiKey: "AIzaSyA33RDvrpWXUeOZYBpfJaqrytbUQFo0cgs", // User's provided API key
    authDomain: "ndis-portal-6ab1e.firebaseapp.com",
    databaseURL: "https://ndis-portal-6ab1e-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "ndis-portal-6ab1e",
    storageBucket: "ndis-portal-6ab1e.appspot.com",
    messagingSenderId: "663606000491",
    appId: "1:663606000491:web:350030eeae4212b899aa2e"
};

// Prioritize __firebase_config if available from the Canvas environment
if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try {
        const parsedConfig = JSON.parse(__firebase_config);
        // Ensure all necessary keys are present in parsedConfig and are not placeholders
        if (parsedConfig &&
            parsedConfig.apiKey && !parsedConfig.apiKey.startsWith("YOUR_") &&
            parsedConfig.authDomain &&
            parsedConfig.projectId &&
            parsedConfig.storageBucket &&
            parsedConfig.messagingSenderId &&
            parsedConfig.appId && !parsedConfig.appId.startsWith("YOUR_")) {
            window.firebaseConfigForApp = parsedConfig;
            console.log("Using Firebase config from __firebase_config environment variable.");
        } else {
            console.warn("__firebase_config is incomplete, uses placeholders, or is missing essential keys. Falling back to manually set config. Ensure __firebase_config provides all required Firebase settings.");
        }
    } catch (e) {
        console.error("Error parsing __firebase_config:", e, "Using manually set config.");
    }
}
// --- End of Firebase Configuration ---


/* ========== DOM Helper Functions ========== */
const $ = q => document.querySelector(q);
const $$ = q => Array.from(document.querySelectorAll(q));

/* ========== Firebase Global Variables ========== */
let fbApp;
let fbAuth;
let fsDb;
let fbStorage;
let currentUserId = null;
let currentUserEmail = null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ndis-portal-app-local';
console.log(`[App Init] Using appId: ${appId}`);

/* ========== UI Element References ========== */
// Main Screens
const authScreenElement = $("#authScreen");
const portalAppElement = $("#portalApp");
// Auth Form
const authEmailInputElement = $("#authEmail"), authPasswordInputElement = $("#authPassword"), authStatusMessageElement = $("#authStatusMessage");
const loginButtonElement = $("#loginBtn"), registerButtonElement = $("#registerBtn"), logoutButtonElement = $("#logoutBtn");
// Portal Common
const userIdDisplayElement = $("#userIdDisplay"), portalTitleDisplayElement = $("#portalTitleDisplay");
const adminTabElement = $("#adminTab"), adminBottomTabElement = $("#adminBottomTab");
// Home
const homeUserDivElement = $("#homeUser"), userNameDisplayElement = $("#userNameDisplay");
const requestShiftButtonElement = $("#rqBtn"), logTodayShiftButtonElement = $("#logTodayShiftBtn");
const shiftRequestsTableBodyElement = $("#rqTbl tbody");
// Profile
const profileNameElement = $("#profileName"), profileAbnElement = $("#profileAbn"), profileGstElement = $("#profileGst");
const profileBsbElement = $("#profileBsb"), profileAccElement = $("#profileAcc");
const profileFilesListElement = $("#profileFilesList"), profileFileUploadElement = $("#profileFileUpload"), uploadProfileDocumentsButtonElement = $("#uploadProfileDocumentsBtn");
const editProfileButtonElement = $("#editProfileBtn");
// Invoice
const invoiceWeekLabelElement = $("#wkLbl"), invoiceNumberInputElement = $("#invNo"), invoiceDateInputElement = $("#invDate");
const providerNameInputElement = $("#provName"), providerAbnInputElement = $("#provAbn"), gstFlagInputElement = $("#gstFlag");
const invoiceTableBodyElement = $("#invTbl tbody"), subtotalElement = $("#sub"), gstRowElement = $("#gstRow"), gstAmountElement = $("#gst"), grandTotalElement = $("#grand");
const addInvoiceRowButtonElement = $("#addInvRowUserActionBtn"), saveDraftButtonElement = $("#saveDraftBtn"), generateInvoicePdfButtonElement = $("#generateInvoicePdfBtn");
const invoicePdfContentElement = $("#invoicePdfContent");
// Agreement
const agreementDynamicTitleElement = $("#agreementDynamicTitle"), adminAgreementWorkerSelectorElement = $("#adminAgreementWorkerSelector");
const adminSelectWorkerForAgreementElement = $("#adminSelectWorkerForAgreement"), loadServiceAgreementForSelectedWorkerButtonElement = $("#loadServiceAgreementForSelectedWorkerBtn");
const agreementChipElement = $("#agrChip"), agreementContentContainerElement = $("#agreementContentContainer");
const participantSignatureImageElement = $("#sigP"), participantSignatureDateElement = $("#dP");
const workerSignatureImageElement = $("#sigW"), workerSignatureDateElement = $("#dW");
const signAgreementButtonElement = $("#signBtn"), participantSignButtonElement = $("#participantSignBtn"), downloadAgreementPdfButtonElement = $("#pdfBtn");
// Admin - Global Settings
const adminEditOrgNameInputElement = $("#adminEditOrgName"), adminEditOrgAbnInputElement = $("#adminEditOrgAbn"), adminEditOrgContactEmailInputElement = $("#adminEditOrgContactEmail"), adminEditOrgContactPhoneInputElement = $("#adminEditOrgContactPhone");
const adminEditParticipantNameInputElement = $("#adminEditParticipantName"), adminEditParticipantNdisNoInputElement = $("#adminEditParticipantNdisNo"), adminEditPlanManagerNameInputElement = $("#adminEditPlanManagerName"), adminEditPlanManagerEmailInputElement = $("#adminEditPlanManagerEmail"), adminEditPlanManagerPhoneInputElement = $("#adminEditPlanManagerPhone"), adminEditPlanEndDateInputElement = $("#adminEditPlanEndDate");
const saveAdminPortalSettingsButtonElement = $("#saveAdminPortalSettingsBtn"), resetGlobalSettingsToDefaultsButtonElement = $("#resetGlobalSettingsToDefaultsBtn");
const inviteLinkCodeElement = $("#invite"), copyInviteLinkButtonElement = $("#copyLinkBtn");
// Admin - Service Management
const adminServiceIdInputElement = $("#adminServiceId"), adminServiceCodeInputElement = $("#adminServiceCode"), adminServiceDescriptionInputElement = $("#adminServiceDescription"), adminServiceCategoryTypeSelectElement = $("#adminServiceCategoryType");
const adminServiceRateFieldsContainerElement = $("#adminServiceRateFieldsContainer"), adminServiceTravelCodeDisplayElement = $("#adminServiceTravelCodeDisplay"), selectTravelCodeButtonElement = $("#selectTravelCodeBtn"), adminServiceTravelCodeInputElement = $("#adminServiceTravelCode");
const saveAdminServiceButtonElement = $("#saveAdminServiceBtn"), clearAdminServiceFormButtonElement = $("#clearAdminServiceFormBtn"), adminServicesTableBodyElement = $("#adminServicesTable tbody");
// Admin - Agreement Customization
const adminAgreementOverallTitleInputElement = $("#adminAgreementOverallTitle"), adminAgreementClausesContainerElement = $("#adminAgreementClausesContainer"), adminAddAgreementClauseButtonElement = $("#adminAddAgreementClauseBtn"), saveAdminAgreementCustomizationsButtonElement = $("#saveAdminAgreementCustomizationsBtn"), adminAgreementPreviewElement = $("#adminAgreementPreview");
// Admin - Worker Management
const workersListForAuthSelectElement = $("#workersListForAuthSelect"), selectedWorkerNameForAuthElement = $("#selectedWorkerNameForAuth"), servicesForWorkerContainerElement = $("#servicesForWorkerContainer"), servicesListCheckboxesElement = $("#servicesListCheckboxes"), saveWorkerAuthorizationsButtonElement = $("#saveWorkerAuthorizationsBtn");

// Modal Bootstrap Instances
let messageModalInstance, confirmationModalInstance, loadingOverlayInstance;
let userSetupWizardModal, adminSetupWizardModal; // For Bootstrap interaction if needed outside Alpine

/* ========== Local State Variables ========== */
let userProfile = {};
let globalSettings = {};
let adminManagedServices = [];
let currentInvoiceData = { items: [], invoiceNumber: "", invoiceDate: "", subtotal: 0, gst: 0, grandTotal: 0 };
let agreementCustomData = {};
let defaultAgreementCustomData = {
    overallTitle: "NDIS Service Agreement",
    clauses: [
        { id: "parties", heading: "1. Parties", body: "This Service Agreement is between:\n\n**The Participant:** {{participantName}} (NDIS No: {{participantNdisNo}}, Plan End Date: {{planEndDate}})\n\nand\n\n**The Provider (Support Worker):** {{workerName}} (ABN: {{workerAbn}})" },
        { id: "purpose", heading: "2. Purpose", body: "Outlines supports {{workerName}} provides to {{participantName}}." },
        { id: "services", heading: "3. Agreed Supports", body: "{{serviceList}}" },
        { id: "provider_resp", heading: "4. Provider Responsibilities", body: "Deliver safe, respectful, professional services." },
        { id: "participant_resp", heading: "5. Participant Responsibilities", body: "Treat provider with respect, provide safe environment." },
        { id: "payments", heading: "6. Payments", body: "Invoices issued to {{planManagerName}} ({{planManagerEmail}}). Terms: 14 days." },
        { id: "cancellations", heading: "7. Cancellations", body: "24 hours' notice required." },
        { id: "feedback", heading: "8. Feedback", body: "Contact {{workerName}} first." },
        { id: "term", heading: "9. Term", body: "Starts {{agreementStartDate}}, ends {{agreementEndDate}} or plan end. Reviewed annually." }
    ]
};
const RATE_CATEGORIES = ["weekday", "evening", "night", "saturday", "sunday", "public"];
const SERVICE_CATEGORY_TYPES = { CORE_STANDARD: 'core_standard', CORE_HIGH_INTENSITY: 'core_high_intensity', CAPACITY_THERAPY_STD: 'capacity_therapy_std', CAPACITY_SPECIALIST: 'capacity_specialist', TRAVEL_KM: 'travel_km', OTHER_FLAT_RATE: 'other_flat_rate' };
let sigCanvas, sigCtx, sigPen = false, sigPaths = [];
let sigCanvasRatio = 1; // For signature pad DPI scaling
let currentAgreementWorkerEmail = null;
let signingAs = 'worker';
let isFirebaseInitialized = false, initialAuthComplete = false;
let selectedWorkerEmailForAuth = null;
let currentAdminServiceEditingId = null;
let allUsersCache = {};
let currentOnConfirmCallback = null;

/* ========== Error Logging ========== */
async function logErrorToFirestore(location, errorMsg, errorDetails = {}) {
    if (!fsDb || !appId || appId === 'ndis-portal-app-local') { console.error("Firestore not init/local dev, no log:", location, errorMsg, errorDetails); return; }
    try {
        await fsAddDoc(collection(fsDb, `artifacts/${appId}/public/logs/errors`), {
            location: String(location), errorMessage: String(errorMsg),
            errorStack: errorDetails instanceof Error ? errorDetails.stack : JSON.stringify(errorDetails),
            user: currentUserEmail || currentUserId || "unknown", timestamp: serverTimestamp(),
            appVersion: "1.2.1-libs-fix", userAgent: navigator.userAgent, url: window.location.href
        });
        console.info("Error logged:", location);
    } catch (logError) { console.error("FATAL: Could not log error:", logError, "Original:", location, errorMsg); }
}

/* ========== UI Helpers (using Bootstrap Modals) ========== */
function showLoading(message = "Loading...") {
    if (!loadingOverlayInstance) loadingOverlayInstance = new bootstrap.Modal(document.getElementById('loadingOverlay'), { keyboard: false, backdrop: 'static' });
    const messageP = document.getElementById('loadingOverlay').querySelector('p');
    if(messageP) messageP.textContent = message;
    loadingOverlayInstance.show();
}
function hideLoading() {
    if (loadingOverlayInstance && loadingOverlayInstance._isShown) {
      loadingOverlayInstance.hide();
    }
}
function showAuthStatusMessage(message, isError = true) {
    if (authStatusMessageElement) {
        authStatusMessageElement.textContent = message;
        authStatusMessageElement.className = `mt-3 text-center ${isError ? 'text-danger' : 'text-success'}`;
        authStatusMessageElement.style.display = message ? 'block' : 'none';
    }
}

function showMessage(title, text, type = 'info') {
    const modalElem = document.getElementById('messageModal');
    if (!modalElem) return;
    if (!messageModalInstance) messageModalInstance = new bootstrap.Modal(modalElem);
    
    const modalTitle = modalElem.querySelector('.modal-title');
    const modalBody = modalElem.querySelector('.modal-body p');
    const iconClass = type === 'success' ? 'fa-check-circle text-success' : type === 'warning' ? 'fa-exclamation-triangle text-warning' : type === 'error' ? 'fa-times-circle text-danger' : 'fa-info-circle text-info';
    
    if (modalTitle) modalTitle.innerHTML = `<i class="fas ${iconClass} me-2"></i>${title}`;
    if (modalBody) modalBody.innerHTML = text;
    messageModalInstance.show();
}

function showConfirmationModal(title, text, onConfirm) {
    const modalElem = document.getElementById('confirmationModal');
    if (!modalElem) return;
    if (!confirmationModalInstance) confirmationModalInstance = new bootstrap.Modal(modalElem);

    const modalTitle = modalElem.querySelector('.modal-title');
    const modalBody = modalElem.querySelector('.modal-body p');
    const confirmBtn = modalElem.querySelector('#confirmationModalConfirmBtn');

    if (modalTitle) modalTitle.innerHTML = `<i class="fas fa-question-circle me-2"></i>${title}`;
    if (modalBody) modalBody.textContent = text;
    
    currentOnConfirmCallback = onConfirm; 

    confirmBtn.removeEventListener('click', handleConfirmAction); 
    confirmBtn.addEventListener('click', handleConfirmAction, { once: true }); 

    confirmationModalInstance.show();
}
function handleConfirmAction() { 
    if (typeof currentOnConfirmCallback === 'function') {
        currentOnConfirmCallback();
    }
    currentOnConfirmCallback = null; 
    if (confirmationModalInstance && confirmationModalInstance._isShown) confirmationModalInstance.hide();
}

function openModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
        modal.show();
    } else { console.error(`Modal with ID ${modalId} not found.`); }
}
function closeModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal && modal._isShown) modal.hide();
    } else { console.error(`Modal with ID ${modalId} not found for closing.`); }
}

function updatePortalTitle() {
    const title = globalSettings.portalTitle || "NDIS Portal";
    if (portalTitleDisplayElement && globalSettings.portalTitle) {
        portalTitleDisplayElement.innerHTML = `<i class="fas fa-cogs me-2"></i>${globalSettings.portalTitle}`;
    } else if (portalTitleDisplayElement) {
        portalTitleDisplayElement.innerHTML = `<i class="fas fa-cogs me-2"></i>NDIS Portal`;
    }
    document.title = title;
}

/* ========== Utilities ========== */
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase()); }
function formatDateForDisplay(d) { if (!d) return ""; try { const date = d.toDate ? d.toDate() : new Date(d); return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return "Invalid"; } }
function formatDateForInput(d) { if (!d) return ""; try { const date = d.toDate ? d.toDate() : new Date(d); const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), day = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; } catch (e) { return ""; } }
function timeToMinutes(t) { if (!t || !t.includes(':')) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function calculateHours(s, e) { if (!s || !e) return 0; const diff = timeToMinutes(e) - timeToMinutes(s); return diff > 0 ? parseFloat((diff / 60).toFixed(2)) : 0; }
function determineRateType(dStr, sTime) { if (!dStr || !sTime) return "weekday"; const d = new Date(`${dStr}T${sTime}:00`); const day = d.getDay(), hr = d.getHours(); if (day === 0) return "sunday"; if (day === 6) return "saturday"; if (hr >= 20 || hr < 6) return "night"; return "weekday"; }
function formatTime12Hour(t24) { if (!t24 || !t24.includes(':')) return ""; const [h, m] = t24.split(':'); const hr = parseInt(h, 10); const ap = hr >= 12 ? 'PM' : 'AM'; let hr12 = hr % 12; hr12 = hr12 ? hr12 : 12; return `${String(hr12).padStart(2, '0')}:${m} ${ap}`; }
function formatCurrency(n) { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n || 0); }
function generateUniqueId(prefix = 'id_') { return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 9); }
function getWeekNumber(d) { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); const yS = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil((((d - yS) / 86400000) + 1) / 7); }


/* ========== Firebase Initialization & Auth ========== */
async function initializeFirebaseApp() {
    console.log("[FirebaseInit] Initializing...");
    const config = window.firebaseConfigForApp; // Now defined at the top of the script

    if (!config || !config.apiKey || config.apiKey.startsWith("YOUR_")) {
        showAuthStatusMessage("System Error: Portal configuration invalid. Missing Firebase config."); hideLoading();
        logErrorToFirestore("initializeFirebaseApp", "Firebase config missing or invalid", { apiKey: config ? config.apiKey : 'undefined' });
        return;
    }
    try {
        fbApp = initializeApp(config, appId);
        fbAuth = getAuth(fbApp);
        fsDb = getFirestore(fbApp);
        fbStorage = getStorage(fbApp);
        isFirebaseInitialized = true;
        console.log("[FirebaseInit] Success.");
        await setupAuthListener();
    } catch (error) {
        console.error("[FirebaseInit] Error:", error);
        logErrorToFirestore("initializeFirebaseApp", error.message, error);
        showAuthStatusMessage("System Error: " + error.message);
        hideLoading();
    }
}

async function setupAuthListener() {
    return new Promise((resolve) => {
        onAuthStateChanged(fbAuth, async (user) => {
            showLoading("Authenticating...");
            try {
                if (user) {
                    currentUserId = user.uid; currentUserEmail = user.email;
                    if(userIdDisplayElement) userIdDisplayElement.textContent = currentUserEmail || currentUserId;
                    if(logoutButtonElement) logoutButtonElement.classList.remove('d-none');
                    if(authScreenElement) authScreenElement.style.display = "none"; 
                    if(portalAppElement) portalAppElement.classList.remove('d-none'); 

                    await loadGlobalSettingsFromFirestore();
                    const profileData = await loadUserProfileFromFirestore(currentUserId);
                    // let signedOut = false; // Not needed as logic directly proceeds or signs out

                    if (profileData) {
                        await handleExistingUserProfile(profileData);
                    } else if (currentUserEmail && globalSettings.adminEmail && currentUserEmail.toLowerCase() === globalSettings.adminEmail.toLowerCase()) {
                        await handleNewAdminProfile();
                    } else if (currentUserId) {
                        await handleNewRegularUserProfile();
                    } else {
                        await fbSignOut(fbAuth); 
                    }
                } else {
                    currentUserId = null; currentUserEmail = null; userProfile = {}; globalSettings = getDefaultGlobalSettings();
                    if(userIdDisplayElement) userIdDisplayElement.textContent = "Not Logged In";
                    if(logoutButtonElement) logoutButtonElement.classList.add('d-none');
                    if(authScreenElement) authScreenElement.style.display = "flex";
                    if(portalAppElement) portalAppElement.classList.add('d-none');
                    updateNavigation(false);
                    navigateToSection("home");
                    updatePortalTitle();
                }
            } catch (error) {
                console.error("[AuthListener] Error:", error);
                logErrorToFirestore("onAuthStateChanged", error.message, error);
                if (fbAuth) await fbSignOut(fbAuth).catch(e => console.error("Sign out error:", e));
            } finally {
                hideLoading();
                if (!initialAuthComplete) { initialAuthComplete = true; resolve(); }
            }
        });
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            signInWithCustomToken(fbAuth, __initial_auth_token).catch(e => logErrorToFirestore("signInWithCustomToken", e.message, e));
        }
    });
}

async function handleExistingUserProfile(data) {
    userProfile = { ...data, uid: currentUserId, email: currentUserEmail };
    // Worker approval logic is removed, users are considered active if their profile exists.
    if (userProfile.isAdmin) {
        await loadAllDataForAdmin();
        enterPortal(true);
        if (!globalSettings.setupComplete) openModal('adminSetupWizardModal');
    } else {
        await loadAllDataForUser();
        enterPortal(false);
        if (!userProfile.profileSetupComplete && globalSettings.portalType !== 'individual_participant') {
            openModal('wizModal'); 
        }
    }
    // return false; // No longer needed as this function doesn't determine sign-out status
}

async function handleNewAdminProfile() {
    userProfile = {
        isAdmin: true, name: "Administrator", email: currentUserEmail, uid: currentUserId,
        approved: true, 
        createdAt: serverTimestamp(), profileSetupComplete: true, nextInvoiceNumber: 1001
    };
    try {
        await setDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), userProfile);
        await loadAllDataForAdmin();
        enterPortal(true);
        if (!globalSettings.setupComplete) openModal('adminSetupWizardModal');
    } catch (error) {
        logErrorToFirestore("handleNewAdminProfile", error.message, error);
        showMessage("Setup Error", "Could not initialize admin account.", "error");
        await fbSignOut(fbAuth); 
    }
    // return false; // No longer needed
}

async function handleNewRegularUserProfile() {
    // Worker approval logic removed, new users are auto-approved.
    userProfile = {
        name: currentUserEmail.split('@')[0], email: currentUserEmail, uid: currentUserId,
        isAdmin: false, approved: true, 
        profileSetupComplete: false, nextInvoiceNumber: 1001, createdAt: serverTimestamp(), authorizedServices: []
    };
    try {
        await setDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), userProfile);
        await loadAllDataForUser();
        enterPortal(false);
        if (!userProfile.profileSetupComplete && globalSettings.portalType !== 'individual_participant') {
            openModal('wizModal');
        }
    } catch (error) {
        logErrorToFirestore("handleNewRegularUserProfile", error.message, error);
        showMessage("Registration Error", "Could not complete registration.", "error");
        await fbSignOut(fbAuth); 
    }
    // return false; // No longer needed
}

async function loadUserProfileFromFirestore(uid) { 
    if (!fsDb || !uid) return null;
    try {
        const snap = await getDoc(doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details"));
        return snap.exists() ? snap.data() : null;
    } catch (e) { logErrorToFirestore("loadUserProfileFromFirestore", e.message, e); return null;}
}
function getDefaultGlobalSettings() {
    return {
        portalTitle: "NDIS Support Portal", adminEmail: "admin@portal.com", setupComplete: false, portalType: "organization",
        agreementTemplate: JSON.parse(JSON.stringify(defaultAgreementCustomData)), 
        organizationName: "Your Organization Name", organizationAbn: "Your ABN", organizationContactEmail: "contact@example.com", organizationContactPhone: "000-000-000",
        defaultParticipantName: "Participant Name", defaultParticipantNdisNo: "000000000", defaultPlanManagerName: "Plan Manager Name",
        defaultPlanManagerEmail: "pm@example.com", defaultPlanManagerPhone: "111-111-111",
        defaultPlanEndDate: formatDateForInput(new Date(new Date().setFullYear(new Date().getFullYear() + 1))),
        requireDocumentUploads: true, defaultCurrency: "AUD"
    };
}
async function loadGlobalSettingsFromFirestore() {
    if (!fsDb) { globalSettings = getDefaultGlobalSettings(); updatePortalTitle(); return; }
    try {
        const snap = await getDoc(doc(fsDb, 'artifacts', appId, 'public', 'settings'));
        if (snap.exists()) globalSettings = { ...getDefaultGlobalSettings(), ...snap.data() };
        else { globalSettings = getDefaultGlobalSettings(); await saveGlobalSettingsToFirestore(true); }
    } catch (e) { logErrorToFirestore("loadGlobalSettingsFromFirestore", e.message, e); globalSettings = getDefaultGlobalSettings(); }
    agreementCustomData = globalSettings.agreementTemplate ? JSON.parse(JSON.stringify(globalSettings.agreementTemplate)) : JSON.parse(JSON.stringify(defaultAgreementCustomData));
    updatePortalTitle();
}
async function saveGlobalSettingsToFirestore(isSilent = false) { 
    if (!fsDb) { if (!isSilent) showMessage("Save Error", "System error.", "error"); return false; }
    globalSettings.agreementTemplate = JSON.parse(JSON.stringify(agreementCustomData));
    try {
        await setDoc(doc(fsDb, 'artifacts', appId, 'public', 'settings'), globalSettings, { merge: true });
        updatePortalTitle(); if (!isSilent) showMessage("Settings Saved", "Global settings updated.", "success");
        return true;
    } catch (e) { logErrorToFirestore("saveGlobalSettingsToFirestore", e.message, e); if (!isSilent) showMessage("Save Error", e.message, "error"); return false; }
}
function renderUserHomePage() { 
    if (!userProfile || !currentUserId || userProfile.isAdmin) {
        if(homeUserDivElement) homeUserDivElement.classList.add('d-none'); return;
    }
    if(homeUserDivElement) homeUserDivElement.classList.remove('d-none');
    if(userNameDisplayElement && userProfile.name) userNameDisplayElement.textContent = userProfile.name;
}
async function loadAdminServicesFromFirestore() {
    adminManagedServices = []; if (!fsDb) return;
    try {
        const qSnap = await getDocs(collection(fsDb, `artifacts/${appId}/public/services`));
        qSnap.forEach(d => adminManagedServices.push({ id: d.id, ...d.data() }));
    } catch (e) { logErrorToFirestore("loadAdminServicesFromFirestore", e.message, e); }
    renderAdminServicesTable();
 }
async function loadAllUsersForAdmin() { 
    allUsersCache = {}; if (!userProfile.isAdmin || !fsDb) return;
    try {
        const usersSnaps = await getDocs(collection(fsDb, `artifacts/${appId}/users`));
        const pPromises = usersSnaps.docs.map(ud => getDoc(doc(fsDb, `artifacts/${appId}/users/${ud.id}/profile`, "details")).catch(() => null));
        const pSnaps = await Promise.all(pPromises);
        pSnaps.forEach(ps => { if (ps && ps.exists()) { const p = ps.data(); allUsersCache[p.uid || ps.id] = { ...p, uid: p.uid || ps.id }; } });
    } catch (e) { logErrorToFirestore("loadAllUsersForAdmin", e.message, e); }
}
async function loadAllDataForUser() { /* Placeholder */ }
async function loadAllDataForAdmin() { 
    await loadAllUsersForAdmin(); await loadAdminServicesFromFirestore();
}

function enterPortal(isAdmin) {
    if(portalAppElement) portalAppElement.classList.remove('d-none'); 
    if(authScreenElement) authScreenElement.style.display = "none"; 

    updateNavigation(isAdmin); updateProfileDisplay(); updatePortalTitle();
    if (isAdmin) { navigateToSection("admin"); renderAdminDashboard(); }
    else { navigateToSection("home"); renderUserHomePage(); }
    if (isAdmin && !globalSettings.setupComplete) openModal('adminSetupWizardModal');
    else if (!isAdmin && userProfile && !userProfile.nextInvoiceNumber && globalSettings.portalType !== 'individual_participant') openModal('setInitialInvoiceModal');
}

function updateNavigation(isAdmin) {
    const linksToShow = ["home", "profile", "invoice", "agreement"];
    if (isAdmin) linksToShow.push("admin");

    $$("nav#side .nav-link, nav#bottom .nav-link").forEach(a => {
        const section = a.dataset.section;
        if (section) {
            a.classList.toggle('d-none', !linksToShow.includes(section));
        }
    });
    if(adminBottomTabElement) adminBottomTabElement.classList.toggle('d-none', !isAdmin); 
}

function navigateToSection(sectionId) {
    if (!sectionId) sectionId = 'home';
    $$("main > section.card").forEach(s => s.classList.remove("active")); 
    const targetSection = $(`#${sectionId}`);
    if (targetSection) targetSection.classList.add("active");
    else { $(`#home`)?.classList.add("active"); sectionId = 'home'; }

    $$("nav#side .nav-link, nav#bottom .nav-link").forEach(a => a.classList.remove("active"));
    $$(`nav [data-section="${sectionId}"]`).forEach(a => a.classList.add("active"));
    
    const mainContentArea = $("main"); if(mainContentArea) mainContentArea.scrollTop = 0;

    switch (sectionId) {
        case "home": if (userProfile && !userProfile.isAdmin) renderUserHomePage(); break;
        case "profile": renderProfileSection(); break;
        case "invoice": renderInvoiceSection(); break;
        case "agreement": renderAgreementSection(); break;
        case "admin": if (userProfile && userProfile.isAdmin) renderAdminDashboard(); else navigateToSection("home"); break;
    }
}

async function modalLogin() { 
    const e = authEmailInputElement.value.trim(), p = authPasswordInputElement.value;
    if (!validateEmail(e) || !p) { showAuthStatusMessage("Invalid email or password."); return; }
    showLoading("Logging in..."); showAuthStatusMessage("", false);
    try { await signInWithEmailAndPassword(fbAuth, e, p); }
    catch (err) { logErrorToFirestore("modalLogin", err.message, err); showAuthStatusMessage("Login failed. Check credentials."); }
    finally { hideLoading(); }
}
async function modalRegister() {
    const e = authEmailInputElement.value.trim(), p = authPasswordInputElement.value;
    if (!validateEmail(e)) { showAuthStatusMessage("Valid email required."); return; }
    if (p.length < 6) { showAuthStatusMessage("Password min 6 chars."); return; }
    showLoading("Registering..."); showAuthStatusMessage("", false);
    try { await createUserWithEmailAndPassword(fbAuth, e, p); }
    catch (err) { logErrorToFirestore("modalRegister", err.message, err); showAuthStatusMessage(err.code === 'auth/email-already-in-use' ? "Email already registered." : "Registration failed.");}
    finally { hideLoading(); }
}
async function portalSignOut() { 
    showLoading("Logging out..."); try { await fbSignOut(fbAuth); }
    catch (e) { logErrorToFirestore("portalSignOut", e.message, e); showMessage("Logout Error", e.message, "error");}
    finally { hideLoading(); }
}

function renderProfileSection() { if (!userProfile || !currentUserId) return; updateProfileDisplay(); }
function updateProfileDisplay() { 
    if (!userProfile) return;
    if(profileNameElement) profileNameElement.textContent = userProfile.name || 'N/A';
    if(profileAbnElement) profileAbnElement.textContent = userProfile.abn || 'N/A';
    if(profileGstElement) profileGstElement.textContent = userProfile.gstRegistered ? 'Yes' : 'No';
    if(profileBsbElement) profileBsbElement.textContent = userProfile.bsb || 'N/A';
    if(profileAccElement) profileAccElement.textContent = userProfile.acc || 'N/A';
    renderProfileFilesList();
}
function renderProfileFilesList() {
    if (!profileFilesListElement) return;
    profileFilesListElement.innerHTML = '';
    const files = userProfile.uploadedFiles || [];
    if (files.length === 0) {
        profileFilesListElement.innerHTML = '<li class="list-group-item">No documents uploaded.</li>'; return;
    }
    files.forEach(file => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `<a href="${file.url}" target="_blank">${file.name}</a>
                        <button class="btn btn-danger btn-sm delete-profile-doc-btn" data-filename="${file.name}" data-filepath="${file.path}"><i class="fas fa-trash"></i></button>`;
        profileFilesListElement.appendChild(li);
    });
}
async function saveProfileDetails(updates) { 
    if (!fsDb || !currentUserId) return false; showLoading("Saving...");
    try {
        await updateDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), { ...updates, updatedAt: serverTimestamp() });
        userProfile = { ...userProfile, ...updates }; updateProfileDisplay();
        showMessage("Profile Saved", "Details updated.", "success"); return true;
    } catch (e) { logErrorToFirestore("saveProfileDetails", e.message, e); showMessage("Save Error", e.message, "error"); return false;}
    finally { hideLoading(); }
}
async function uploadProfileDocuments() { 
    if (!fbStorage || !currentUserId || !profileFileUploadElement?.files?.length) { showMessage("Upload Error", "Select a file.", "warning"); return;}
    showLoading(`Uploading ${profileFileUploadElement.files.length} file(s)...`);
    try {
        const uploads = Array.from(profileFileUploadElement.files).map(async f => {
            const fp = `artifacts/${appId}/users/${currentUserId}/profileDocuments/${Date.now()}_${f.name}`;
            const fRef = ref(fbStorage, fp); await uploadBytes(fRef, f); const url = await getDownloadURL(fRef);
            return { name: f.name, url, path: fp, uploadedAt: serverTimestamp() };
        });
        const metas = await Promise.all(uploads);
        await updateDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), { uploadedFiles: arrayUnion(...metas), updatedAt: serverTimestamp() });
        if (!userProfile.uploadedFiles) userProfile.uploadedFiles = [];
        userProfile.uploadedFiles.push(...metas.map(m => ({...m, uploadedAt: new Date()}))); 
        renderProfileFilesList(); showMessage("Upload Successful", "File(s) uploaded.", "success"); profileFileUploadElement.value = '';
    } catch (e) { logErrorToFirestore("uploadProfileDocuments", e.message, e); showMessage("Upload Failed", e.message, "error");}
    finally { hideLoading(); }
}
function requestDeleteProfileDocument(fileName, filePath) { 
    showConfirmationModal(
        "Confirm Delete Document",
        `Delete "${fileName}"? This cannot be undone.`,
        () => executeDeleteProfileDocument(fileName, filePath)
    );
}
async function executeDeleteProfileDocument(fileName, filePath) {
    if (!fbStorage || !fsDb || !currentUserId || !filePath) return; showLoading(`Deleting ${fileName}...`);
    try {
        await deleteObject(ref(fbStorage, filePath));
        const profileRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        const currentProfileSnap = await getDoc(profileRef);
        if (currentProfileSnap.exists()) {
            const currentFiles = currentProfileSnap.data().uploadedFiles || [];
            const fileToRemove = currentFiles.find(f => f.path === filePath);
            if (fileToRemove) {
                await updateDoc(profileRef, { uploadedFiles: arrayRemove(fileToRemove), updatedAt: serverTimestamp() });
                userProfile.uploadedFiles = (userProfile.uploadedFiles || []).filter(f => f.path !== filePath);
                renderProfileFilesList(); showMessage("File Deleted", `"${fileName}" deleted.`, "success");
            }
        }
    } catch (e) { logErrorToFirestore("executeDeleteProfileDocument", e.message, e); showMessage("Delete Failed", e.message, "error");}
    finally { hideLoading(); }
}

function renderInvoiceSection() { if (!userProfile) return; populateInvoiceHeader(); loadUserInvoiceDraft(); }
function populateInvoiceHeader() { 
    if (!userProfile) return;
    if(invoiceDateInputElement) invoiceDateInputElement.value = formatDateForInput(new Date()); 
    if(invoiceWeekLabelElement && invoiceDateInputElement) invoiceWeekLabelElement.textContent = getWeekNumber(new Date(invoiceDateInputElement.value));
    if(invoiceNumberInputElement) invoiceNumberInputElement.value = userProfile.nextInvoiceNumber || '1001';
    if(providerNameInputElement) providerNameInputElement.value = userProfile.name || '';
    if(providerAbnInputElement) providerAbnInputElement.value = userProfile.abn || '';
    if(gstFlagInputElement) gstFlagInputElement.checked = userProfile.gstRegistered || false;
    if(gstRowElement) gstRowElement.classList.toggle('d-none', !gstFlagInputElement.checked);
}
function renderInvoiceTable() { 
    if (!invoiceTableBodyElement) return; invoiceTableBodyElement.innerHTML = '';
    currentInvoiceData.items.forEach((item, i) => addInvoiceRowToTable(item, i));
    updateInvoiceTotals();
}
function addInvoiceRowToTable(item = {}, index = -1) {
    if (!invoiceTableBodyElement) return;
    const newRow = invoiceTableBodyElement.insertRow(index);
    newRow.classList.add('invoice-item-row'); newRow.dataset.itemId = item.id || generateUniqueId('item_');
    newRow.innerHTML = `
        <td>${invoiceTableBodyElement.rows.length}</td>
        <td><input type="text" class="form-control form-control-sm flatpickr-date inv-item-date" value="${item.date ? formatDateForInput(new Date(item.date)) : formatDateForInput(new Date())}"></td>
        <td>
            <select class="form-select form-select-sm inv-item-service-code">
                <option value="">Select Service</option>
                ${(userProfile.isAdmin ? adminManagedServices : (userProfile.authorizedServices || []).map(sId => adminManagedServices.find(as => as.id === sId)).filter(s=>s) ).map(service => 
                    `<option value="${service.id}" ${item.serviceId === service.id ? 'selected' : ''} data-code="${service.serviceCode || ''}">${service.description} (${service.serviceCode || 'No Code'})</option>`
                ).join('')}
            </select>
        </td>
        <td><input type="text" class="form-control form-control-sm inv-item-desc" placeholder="Description" value="${item.description || ''}"></td>
        <td><input type="text" class="form-control form-control-sm flatpickr-time inv-item-start" value="${item.startTime || '09:00'}"></td>
        <td><input type="text" class="form-control form-control-sm flatpickr-time inv-item-end" value="${item.endTime || '10:00'}"></td>
        <td><input type="number" class="form-control form-control-sm inv-item-hours" value="${item.hours || '1.00'}" step="0.01" readonly></td>
        <td><input type="number" class="form-control form-control-sm inv-item-rate" value="${parseFloat(item.rate || 0).toFixed(2)}" step="0.01"></td>
        <td><input type="number" class="form-control form-control-sm inv-item-total" value="${parseFloat(item.total || 0).toFixed(2)}" readonly></td>
        <td><button class="btn btn-danger btn-sm delete-invoice-row-btn"><i class="fas fa-trash"></i></button></td>
    `;
    initFlatpickrForRow(newRow);
    newRow.querySelectorAll('.inv-item-date, .inv-item-desc, .inv-item-service-code, .inv-item-start, .inv-item-end, .inv-item-rate').forEach(input => {
        input.addEventListener('change', () => updateInvoiceItemFromRow(newRow, Array.from(invoiceTableBodyElement.children).indexOf(newRow) ));
        if (input.type === 'text' || input.type === 'number') input.addEventListener('input', () => updateInvoiceItemFromRow(newRow, Array.from(invoiceTableBodyElement.children).indexOf(newRow) ));
    });
    newRow.querySelector('.delete-invoice-row-btn').addEventListener('click', function() {
        requestDeleteInvoiceRow(this);
    });
    updateInvoiceItemFromRow(newRow, Array.from(invoiceTableBodyElement.children).indexOf(newRow));
}
function addInvRowUserAction() { const newItem = {id: generateUniqueId('item_')}; currentInvoiceData.items.push(newItem); addInvoiceRowToTable(newItem); }
function updateInvoiceItemFromRow(row, index) { 
    if (!row || index < 0 || index >= currentInvoiceData.items.length) return;
    const item = currentInvoiceData.items[index]; if (!item) return;
    const dateInput = row.querySelector('.inv-item-date');
    const descInput = row.querySelector('.inv-item-desc');
    const serviceCodeSelect = row.querySelector('.inv-item-service-code');
    const startInput = row.querySelector('.inv-item-start');
    const endInput = row.querySelector('.inv-item-end');
    const hoursInput = row.querySelector('.inv-item-hours');
    const rateInput = row.querySelector('.inv-item-rate');
    const totalInput = row.querySelector('.inv-item-total');

    item.date = dateInput.value;
    item.description = descInput.value;
    item.startTime = startInput.value;
    item.endTime = endInput.value;

    const selectedServiceOption = serviceCodeSelect.options[serviceCodeSelect.selectedIndex];
    item.serviceId = selectedServiceOption ? selectedServiceOption.value : '';
    item.serviceCode = selectedServiceOption ? selectedServiceOption.dataset.code : '';

    if (item.serviceId) {
        const service = adminManagedServices.find(s => s.id === item.serviceId);
        if (service) {
            if (!item.description && service.description) { 
                descInput.value = service.description;
                item.description = service.description;
            }
            const rateType = determineRateType(item.date, item.startTime);
            let determinedRate = 0;
            if (service.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM || service.categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
                determinedRate = service.rates?.flat || 0;
            } else {
                determinedRate = service.rates?.[rateType] || service.rates?.weekday || 0;
            }
            rateInput.value = parseFloat(determinedRate).toFixed(2);
        }
    }
    item.rate = parseFloat(rateInput.value) || 0;
    const hours = calculateHours(item.startTime, item.endTime);
    hoursInput.value = hours.toFixed(2);
    item.hours = hours;
    const total = item.hours * item.rate;
    totalInput.value = total.toFixed(2);
    item.total = total;
    updateInvoiceTotals();
}
function requestDeleteInvoiceRow(buttonElement) { 
    const row = buttonElement.closest('tr');
    const itemNumber = row ? Array.from(invoiceTableBodyElement.children).indexOf(row) + 1 : 'this item';
    showConfirmationModal(
        "Confirm Delete Item",
        `Delete invoice item #${itemNumber}?`,
        () => executeDeleteInvoiceRow(row)
    );
}
function executeDeleteInvoiceRow(row) {
    if (!row || !invoiceTableBodyElement) return;
    const idx = Array.from(invoiceTableBodyElement.children).indexOf(row);
    if (idx > -1 && idx < currentInvoiceData.items.length) {
        currentInvoiceData.items.splice(idx, 1); row.remove();
        invoiceTableBodyElement.querySelectorAll('tr').forEach((r, i) => { if(r.cells[0]) r.cells[0].textContent = i + 1; });
        updateInvoiceTotals();
    }
}
function updateInvoiceTotals() {
    let subtotal = 0; currentInvoiceData.items.forEach(item => { subtotal += item.total || 0; });
    currentInvoiceData.subtotal = subtotal;
    let gstAmount = 0; if (gstFlagInputElement?.checked) gstAmount = subtotal * 0.10;
    currentInvoiceData.gst = gstAmount;
    currentInvoiceData.grandTotal = subtotal + gstAmount;
    if(subtotalElement) subtotalElement.textContent = formatCurrency(subtotal);
    if(gstAmountElement) gstAmountElement.textContent = formatCurrency(gstAmount);
    if(grandTotalElement) grandTotalElement.textContent = formatCurrency(grandTotal);
    if(gstRowElement) gstRowElement.classList.toggle('d-none', !gstFlagInputElement?.checked || gstAmount === 0);
}
async function saveInvoiceDraft() { 
    if (!fsDb || !currentUserId) { showMessage("Error", "Cannot save draft.", "error"); return; }
    currentInvoiceData.invoiceNumber = invoiceNumberInputElement.value;
    currentInvoiceData.invoiceDate = invoiceDateInputElement.value; 
    currentInvoiceData.providerName = providerNameInputElement.value;
    currentInvoiceData.providerAbn = providerAbnInputElement.value;
    currentInvoiceData.gstRegistered = gstFlagInputElement.checked;
    showLoading("Saving draft...");
    try {
        await setDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, "draft"), { ...currentInvoiceData, lastSaved: serverTimestamp() });
        showMessage("Draft Saved", "Invoice draft saved.", "success");
    } catch (e) { logErrorToFirestore("saveInvoiceDraft", e.message, e); showMessage("Save Failed", e.message, "error");}
    finally { hideLoading(); }
}
async function loadUserInvoiceDraft() { 
    if (!fsDb || !currentUserId) { 
        currentInvoiceData = { items: [], invoiceNumber: userProfile.nextInvoiceNumber || "1001", invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0 };
        populateInvoiceHeader(); renderInvoiceTable(); return;
    }
    showLoading("Loading draft...");
    try {
        const snap = await getDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, "draft"));
        if (snap.exists()) { 
            currentInvoiceData = snap.data(); 
            currentInvoiceData.invoiceDate = currentInvoiceData.invoiceDate ? formatDateForInput(new Date(currentInvoiceData.invoiceDate)) : formatDateForInput(new Date());
            currentInvoiceData.items = (currentInvoiceData.items || []).map(item => ({...item, date: item.date ? formatDateForInput(new Date(item.date)) : formatDateForInput(new Date()) }));
        } else { 
            currentInvoiceData = { items: [], invoiceNumber: userProfile.nextInvoiceNumber || "1001", invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0 };
        }
        populateInvoiceHeader(); renderInvoiceTable();
    } catch (e) { 
        logErrorToFirestore("loadUserInvoiceDraft", e.message, e); 
        currentInvoiceData = { items: [], invoiceNumber: userProfile.nextInvoiceNumber || "1001", invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0 };
        populateInvoiceHeader(); renderInvoiceTable();
    } finally { hideLoading(); }
}
async function saveInitialInvoiceNumber() {
    const n = parseInt(initialInvoiceNumberInputElement.value, 10);
    if (isNaN(n) || n <= 0) { showMessage("Invalid Number", "Positive whole number required.", "warning"); return; }
    if (userProfile) {
        const success = await saveProfileDetails({ nextInvoiceNumber: n });
        if (success) { closeModal('setInitialInvoiceModal'); if(invoiceNumberInputElement) invoiceNumberInputElement.value = n; }
    } else { showMessage("Error", "User profile not loaded.", "error"); }
}
function generateInvoicePdf() { /* ... same core logic ... */ }

function renderAgreementSection() { 
    if (!userProfile) return;
    if (userProfile.isAdmin) { 
        if(adminAgreementWorkerSelectorElement) adminAgreementWorkerSelectorElement.classList.remove('d-none'); 
        if(adminSelectWorkerForAgreementElement) {
            adminSelectWorkerForAgreementElement.innerHTML = '<option value="">-- Select Worker --</option>';
            Object.values(allUsersCache).filter(u => !u.isAdmin).forEach(worker => { // Removed u.approved check
                const option = document.createElement('option');
                option.value = worker.email; 
                option.textContent = `${worker.name || worker.email} (${worker.email})`;
                adminSelectWorkerForAgreementElement.appendChild(option);
            });
        }
        if(agreementContentContainerElement) agreementContentContainerElement.innerHTML = "<p>Select a worker to view or manage their service agreement.</p>";
        updateAgreementChip(null);
    } else { 
        if(adminAgreementWorkerSelectorElement) adminAgreementWorkerSelectorElement.classList.add('d-none');
        currentAgreementWorkerEmail = currentUserEmail; 
        loadAndRenderServiceAgreement(currentAgreementWorkerEmail); 
    }
}
async function loadAndRenderServiceAgreement(workerEmailToLoad = null) { 
    const targetWorkerEmail = workerEmailToLoad || currentUserEmail;
    if (!fsDb || !targetWorkerEmail) { /* handle error */ return; }
    showLoading("Loading agreement...");
    try {
        let targetWorkerProfile = (targetWorkerEmail === currentUserEmail) ? userProfile : Object.values(allUsersCache).find(u => u.email === targetWorkerEmail);
        if (!targetWorkerProfile || !targetWorkerProfile.uid) throw new Error(`Worker profile not found for ${targetWorkerEmail}`);
        
        const targetWorkerUid = targetWorkerProfile.uid;
        currentAgreementWorkerEmail = targetWorkerEmail; 

        const agreementRef = doc(fsDb, `artifacts/${appId}/users/${targetWorkerUid}/agreement`, "details");
        const agreementSnap = await getDoc(agreementRef);
        let agreementData;

        if (agreementSnap.exists()) {
            agreementData = agreementSnap.data();
        } else {
            const newAgreementContentSnapshot = renderAgreementClauses(targetWorkerProfile, globalSettings, {}, true); 
            agreementData = { 
                workerUid: targetWorkerUid, workerEmail: targetWorkerProfile.email,
                participantSignature: null, participantSignatureDate: null,
                workerSignature: null, workerSignatureDate: null, status: "draft", 
                createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
                contentSnapshot: newAgreementContentSnapshot,
                agreementTemplateUsed: JSON.parse(JSON.stringify(agreementCustomData))
            };
            await setDoc(agreementRef, agreementData); 
        }
        window.currentLoadedAgreement = agreementData; 
        window.currentLoadedAgreementWorkerUid = targetWorkerUid; 
        const agreementHtmlToRender = agreementData.contentSnapshot || renderAgreementClauses(targetWorkerProfile, globalSettings, agreementData, true);
        if (agreementContentContainerElement) agreementContentContainerElement.innerHTML = agreementHtmlToRender;
        updateAgreementChip(agreementData); 
        updateSignatureDisplays(agreementData);
        updateAgreementActionButtons(targetWorkerProfile); 
    } catch (e) { logErrorToFirestore("loadAndRenderServiceAgreement", e.message, e); /* handle error display */ }
    finally { hideLoading(); }
}
function renderAgreementClauses(workerProfile, settings, agreementState, returnAsString = false) { /* ... same core logic ... */ }
function updateSignatureDisplays(agreementData) { 
    if (!agreementData) return;
    const placeholderSig = 'https://placehold.co/250x85/e8e8e8/666666?text=Signature+Area&txtsize=16';
    if (participantSignatureImageElement) {
        participantSignatureImageElement.src = agreementData.participantSignature || placeholderSig;
        // Bootstrap d-none/d-block can be used if image itself is hidden, or just border changes
        participantSignatureImageElement.style.border = agreementData.participantSignature ? '1px solid var(--ok)' : '1px dashed var(--bs-border-color)';
    }
    if (participantSignatureDateElement) participantSignatureDateElement.textContent = agreementData.participantSignatureDate ? `Signed: ${formatDateForDisplay(agreementData.participantSignatureDate.toDate ? agreementData.participantSignatureDate.toDate() : new Date(agreementData.participantSignatureDate))}` : 'Not Signed';
    if (workerSignatureImageElement) {
        workerSignatureImageElement.src = agreementData.workerSignature || placeholderSig;
        workerSignatureImageElement.style.border = agreementData.workerSignature ? '1px solid var(--ok)' : '1px dashed var(--bs-border-color)';
    }
    if (workerSignatureDateElement) workerSignatureDateElement.textContent = agreementData.workerSignatureDate ? `Signed: ${formatDateForDisplay(agreementData.workerSignatureDate.toDate ? agreementData.workerSignatureDate.toDate() : new Date(agreementData.workerSignatureDate))}` : 'Not Signed';
}
function updateAgreementChip(agreementData) { 
    if (!agreementChipElement) return; if (!agreementData || !agreementData.status) { agreementChipElement.className = 'badge d-none'; return; }
    let statusText = "Draft", chipClass = "badge bg-warning text-dark"; // Bootstrap classes
    if (agreementData.workerSignature && agreementData.participantSignature) { statusText = "Active - Fully Signed"; chipClass = "badge bg-success"; }
    else if (agreementData.workerSignature) { statusText = "Signed by Worker"; chipClass = "badge bg-info text-dark"; }
    else if (agreementData.participantSignature) { statusText = "Signed by Participant"; chipClass = "badge bg-info text-dark"; }
    agreementChipElement.textContent = statusText; agreementChipElement.className = chipClass + " p-2 fs-6 mb-3";
    agreementChipElement.classList.remove('d-none');
}
function updateAgreementActionButtons(targetWorkerProfile) {
    if (!window.currentLoadedAgreement || !signAgreementButtonElement || !participantSignButtonElement || !downloadAgreementPdfButtonElement || !targetWorkerProfile) return;
    const agreementData = window.currentLoadedAgreement;
    const isCurrentUserTheWorkerOfAgreement = currentUserId === targetWorkerProfile.uid;
    const isAdminViewing = userProfile.isAdmin;

    signAgreementButtonElement.classList.add('d-none');
    if (isCurrentUserTheWorkerOfAgreement && !agreementData.workerSignature) {
        signAgreementButtonElement.classList.remove('d-none');
        signAgreementButtonElement.textContent = "Sign as Support Worker";
    }
    participantSignButtonElement.classList.add('d-none');
    if (isAdminViewing && !agreementData.participantSignature) {
        if (!isCurrentUserTheWorkerOfAgreement || (isCurrentUserTheWorkerOfAgreement && globalSettings.portalType === 'individual_participant')) {
            participantSignButtonElement.classList.remove('d-none');
            participantSignButtonElement.textContent = "Sign for Participant (Admin)";
        }
    }
    downloadAgreementPdfButtonElement.classList.toggle('d-none', !(agreementData && agreementData.contentSnapshot));
}
function openSignatureModal(whoIsSigning) { signingAs = whoIsSigning; openModal('sigModal'); initializeSignaturePad(); }
function initializeSignaturePad() { 
    if (!signatureCanvasElement) return; sigCanvas = signatureCanvasElement; sigCtx = sigCanvas.getContext('2d');
    sigCanvasRatio = Math.max(window.devicePixelRatio || 1, 1); 
    const cs = getComputedStyle(sigCanvas);
    const width = parseInt(cs.getPropertyValue('width'), 10);
    const height = parseInt(cs.getPropertyValue('height'), 10);
    sigCanvas.width = width * sigCanvasRatio; 
    sigCanvas.height = height * sigCanvasRatio;
    sigCtx.scale(sigCanvasRatio, sigCanvasRatio); 
    sigCtx.strokeStyle = "#000000"; sigCtx.lineWidth = 2; sigCtx.lineCap = "round"; sigCtx.lineJoin = "round";
    clearSignaturePad(); 
    sigCanvas.removeEventListener('mousedown', sigStart); sigCanvas.removeEventListener('mousemove', sigDraw); sigCanvas.removeEventListener('mouseup', sigEnd); sigCanvas.removeEventListener('mouseout', sigEnd);
    sigCanvas.removeEventListener('touchstart', sigStart); sigCanvas.removeEventListener('touchmove', sigDraw); sigCanvas.removeEventListener('touchend', sigEnd);
    sigCanvas.addEventListener('mousedown', sigStart, false); sigCanvas.addEventListener('mousemove', sigDraw, false); sigCanvas.addEventListener('mouseup', sigEnd, false); sigCanvas.addEventListener('mouseout', sigEnd, false);
    sigCanvas.addEventListener('touchstart', sigStart, { passive: false }); sigCanvas.addEventListener('touchmove', sigDraw, { passive: false }); sigCanvas.addEventListener('touchend', sigEnd);
}
function clearSignaturePad() { if (!sigCtx || !sigCanvas) return; sigCtx.clearRect(0, 0, sigCanvas.width / sigCanvasRatio, sigCanvas.height / sigCanvasRatio); sigPaths = []; } 
function sigStart(e) { e.preventDefault(); sigPen = true; const pos = getSigPenPosition(e); sigCtx.beginPath(); sigCtx.moveTo(pos.x, pos.y); sigPaths.push([{ x: pos.x, y: pos.y }]); }
function sigDraw(e) { e.preventDefault(); if (!sigPen) return; const pos = getSigPenPosition(e); sigCtx.lineTo(pos.x, pos.y); sigCtx.stroke(); if (sigPaths.length > 0) sigPaths[sigPaths.length - 1].push({ x: pos.x, y: pos.y }); }
function sigEnd(e) { e.preventDefault(); if (!sigPen) return; sigPen = false; }
function getSigPenPosition(e) { 
    const rect = sigCanvas.getBoundingClientRect(); let clientX, clientY;
    if (e.touches?.length) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { clientX = e.clientX; clientY = e.clientY; }
    // Corrected scaling: client coordinates are already relative to viewport.
    // We need to map them to the canvas's internal coordinate system, considering its CSS size.
    return { 
        x: (clientX - rect.left) * (sigCanvas.width / sigCanvasRatio / rect.width), 
        y: (clientY - rect.top) * (sigCanvas.height / sigCanvasRatio / rect.height)
    };
}
async function saveSignature() { 
    if (!sigCanvas || sigPaths.length === 0) { showMessage("Signature Error", "Please sign.", "warning"); return; }
    if (!window.currentLoadedAgreement || !window.currentLoadedAgreementWorkerUid) { showMessage("Error", "No agreement loaded.", "error"); return; }
    const signatureDataUrl = sigCanvas.toDataURL('image/png'); showLoading("Saving signature...");
    const agreementUpdate = {}; const signatureDate = serverTimestamp(); 
    if (signingAs === 'worker') { agreementUpdate.workerSignature = signatureDataUrl; agreementUpdate.workerSignatureDate = signatureDate; }
    else if (signingAs === 'participant') { agreementUpdate.participantSignature = signatureDataUrl; agreementUpdate.participantSignatureDate = signatureDate; }
    else { hideLoading(); showMessage("Error", "Unknown signer.", "error"); return; }
    let newStatus = window.currentLoadedAgreement.status || "draft";
    const hasWorkerSig = agreementUpdate.workerSignature || window.currentLoadedAgreement.workerSignature;
    const hasParticipantSig = agreementUpdate.participantSignature || window.currentLoadedAgreement.participantSignature;
    if (hasWorkerSig && hasParticipantSig) newStatus = 'active';
    else if (hasWorkerSig) newStatus = 'signed_by_worker';
    else if (hasParticipantSig) newStatus = 'signed_by_participant';
    agreementUpdate.status = newStatus; agreementUpdate.updatedAt = serverTimestamp();
    try {
        const agreementRef = doc(fsDb, `artifacts/${appId}/users/${window.currentLoadedAgreementWorkerUid}/agreement`, "details");
        const agreementSnap = await getDoc(agreementRef);
        if (agreementSnap.exists()) await updateDoc(agreementRef, agreementUpdate);
        else { /* Fallback to setDoc if somehow deleted, as before */ }
        closeModal('sigModal'); showMessage("Signature Saved", "Signature saved.", "success");
        await loadAndRenderServiceAgreement(currentAgreementWorkerEmail); 
    } catch (e) { logErrorToFirestore("saveSignature", e.message, e); showMessage("Save Failed", e.message, "error"); }
    finally { hideLoading(); }
}
function generateAgreementPdf() { /* ... same core logic ... */ }

function renderAdminDashboard() { /* Placeholder */ }
function renderAdminGlobalSettingsTab() { 
    if(!adminEditOrgNameInputElement || !globalSettings) return; 
    adminEditOrgNameInputElement.value = globalSettings.organizationName || '';
    adminEditOrgAbnInputElement.value = globalSettings.organizationAbn || '';
    adminEditOrgContactEmailInputElement.value = globalSettings.organizationContactEmail || '';
    adminEditOrgContactPhoneInputElement.value = globalSettings.organizationContactPhone || '';
    adminEditParticipantNameInputElement.value = globalSettings.defaultParticipantName || '';
    adminEditParticipantNdisNoInputElement.value = globalSettings.defaultParticipantNdisNo || '';
    adminEditPlanManagerNameInputElement.value = globalSettings.defaultPlanManagerName || '';
    adminEditPlanManagerEmailInputElement.value = globalSettings.defaultPlanManagerEmail || '';
    adminEditPlanManagerPhoneInputElement.value = globalSettings.defaultPlanManagerPhone || '';
    adminEditPlanEndDateInputElement.value = globalSettings.defaultPlanEndDate || '';
    if(inviteLinkCodeElement) inviteLinkCodeElement.value = `${window.location.origin}${window.location.pathname}?register=true`;
}
async function saveAdminPortalSettings() { 
    if(!adminEditOrgNameInputElement) return;
    globalSettings.organizationName = adminEditOrgNameInputElement.value.trim();
    globalSettings.organizationAbn = adminEditOrgAbnInputElement.value.trim();
    globalSettings.organizationContactEmail = adminEditOrgContactEmailInputElement.value.trim();
    globalSettings.organizationContactPhone = adminEditOrgContactPhoneInputElement.value.trim();
    globalSettings.defaultParticipantName = adminEditParticipantNameInputElement.value.trim();
    globalSettings.defaultParticipantNdisNo = adminEditParticipantNdisNoInputElement.value.trim();
    globalSettings.defaultPlanManagerName = adminEditPlanManagerNameInputElement.value.trim();
    globalSettings.defaultPlanManagerEmail = adminEditPlanManagerEmailInputElement.value.trim();
    globalSettings.defaultPlanManagerPhone = adminEditPlanManagerPhoneInputElement.value.trim();
    globalSettings.defaultPlanEndDate = adminEditPlanEndDateInputElement.value;
    await saveGlobalSettingsToFirestore();
}
function requestResetGlobalSettings() { 
    showConfirmationModal("Confirm Reset Settings", "Reset all portal settings to defaults? This cannot be undone.", executeResetGlobalSettings);
}
async function executeResetGlobalSettings() { 
    globalSettings = getDefaultGlobalSettings(); globalSettings.setupComplete = false;
    agreementCustomData = JSON.parse(JSON.stringify(defaultAgreementCustomData));
    globalSettings.agreementTemplate = agreementCustomData;
    if (await saveGlobalSettingsToFirestore()) { renderAdminGlobalSettingsTab(); showMessage("Settings Reset", "Global settings reset.", "success");}
}
function renderAdminServiceManagementTab() { loadAdminServicesFromFirestore(); }
function renderAdminServicesTable() { 
    if (!adminServicesTableBodyElement) return; adminServicesTableBodyElement.innerHTML = '';
    adminManagedServices.forEach(s => {
        const r = adminServicesTableBodyElement.insertRow();
        r.innerHTML = `<td>${s.serviceCode||''}</td><td>${s.description||''}</td><td>${s.categoryType||''}</td><td>${formatCurrency(s.rates?.weekday || s.rates?.flat || 0)}</td><td>${s.travelCode||'None'}</td>
                       <td><button class="btn btn-sm btn-outline-secondary me-1 edit-service-btn" data-id="${s.id}"><i class="fas fa-edit"></i></button>
                           <button class="btn btn-sm btn-outline-danger delete-service-btn" data-id="${s.id}" data-desc="${s.description||'this service'}"><i class="fas fa-trash"></i></button></td>`;
    });
}
function handleAdminServiceAction(e) {
    const editBtn = e.target.closest('.edit-service-btn');
    const deleteBtn = e.target.closest('.delete-service-btn');
    if (editBtn) { 
        currentAdminServiceEditingId = editBtn.dataset.id;
        const service = adminManagedServices.find(s => s.id === currentAdminServiceEditingId);
        if(service && adminServiceCodeInputElement && adminServiceDescriptionInputElement && adminServiceCategoryTypeSelectElement && adminServiceTravelCodeInputElement) { 
            adminServiceCodeInputElement.value = service.serviceCode || '';
            adminServiceDescriptionInputElement.value = service.description || '';
            adminServiceCategoryTypeSelectElement.value = service.categoryType || SERVICE_CATEGORY_TYPES.CORE_STANDARD;
            renderAdminServiceRateFields(); // This will now populate based on selected category
            // Populate rate fields based on service.rates
            if (service.rates) {
                Object.keys(service.rates).forEach(rateKey => {
                    const rateInput = $(`#adminServiceRate_${rateKey}`);
                    if (rateInput) rateInput.value = service.rates[rateKey];
                });
            }
            adminServiceTravelCodeInputElement.value = service.travelCode || '';
            if(adminServiceTravelCodeDisplayElement) adminServiceTravelCodeDisplayElement.value = service.travelCode ? (adminManagedServices.find(ts => ts.id === service.travelCode)?.description || service.travelCode) : 'None selected';
        }
    } else if (deleteBtn) {
        requestDeleteAdminService(deleteBtn.dataset.id, deleteBtn.dataset.desc);
    }
}
function requestDeleteAdminService(id, description) {
    showConfirmationModal("Confirm Delete Service", `Delete NDIS service "${description}"? This is global.`, () => executeDeleteAdminService(id));
}
async function executeDeleteAdminService(id) { 
    if (!fsDb || !id) return; showLoading(`Deleting service ${id}...`);
    try {
        await deleteDoc(doc(fsDb, `artifacts/${appId}/public/services`, id));
        adminManagedServices = adminManagedServices.filter(s => s.id !== id); 
        renderAdminServicesTable(); showMessage("Service Deleted", `Service ${id} deleted.`, "success");
    } catch (e) { logErrorToFirestore("executeDeleteAdminService", e.message, e); showMessage("Delete Failed", e.message, "error");}
    finally { hideLoading(); }
}
async function saveAdminServiceToFirestore() { 
    if (!adminServiceCodeInputElement?.value || !adminServiceDescriptionInputElement?.value) {
        showMessage("Validation Error", "Service Code and Description are required.", "warning"); return;
    }
    const serviceData = {
        serviceCode: adminServiceCodeInputElement.value.trim(),
        description: adminServiceDescriptionInputElement.value.trim(),
        categoryType: adminServiceCategoryTypeSelectElement.value,
        rates: {},
        travelCode: adminServiceTravelCodeInputElement.value || null, // Store null if empty
        updatedAt: serverTimestamp()
    };
    // Collect rates from dynamically generated fields
    adminServiceRateFieldsContainerElement.querySelectorAll('input[data-rate-key]').forEach(input => {
        if (input.value) serviceData.rates[input.dataset.rateKey] = parseFloat(input.value);
    });
    if (Object.keys(serviceData.rates).length === 0 && serviceData.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM && serviceData.categoryType !== SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
         // For time-based services, at least one rate should be set, or handle this more gracefully.
         // For now, allow saving without rates, but it might cause issues in invoicing.
    }

    showLoading("Saving service...");
    try {
        let serviceRef;
        if (currentAdminServiceEditingId) {
            serviceRef = doc(fsDb, `artifacts/${appId}/public/services`, currentAdminServiceEditingId);
            await updateDoc(serviceRef, serviceData);
        } else {
            serviceData.createdAt = serverTimestamp();
            serviceRef = await fsAddDoc(collection(fsDb, `artifacts/${appId}/public/services`), serviceData);
        }
        await loadAdminServicesFromFirestore(); // Reload all services
        clearAdminServiceForm();
        showMessage("Service Saved", "NDIS service details saved.", "success");
    } catch (e) { logErrorToFirestore("saveAdminServiceToFirestore", e.message, e); showMessage("Save Failed", e.message, "error");}
    finally { hideLoading(); }
}
function clearAdminServiceForm() { 
    if(adminServiceIdInputElement) adminServiceIdInputElement.value = '';
    if(adminServiceCodeInputElement) adminServiceCodeInputElement.value = '';
    if(adminServiceDescriptionInputElement) adminServiceDescriptionInputElement.value = '';
    if(adminServiceCategoryTypeSelectElement) adminServiceCategoryTypeSelectElement.value = SERVICE_CATEGORY_TYPES.CORE_STANDARD;
    if(adminServiceTravelCodeInputElement) adminServiceTravelCodeInputElement.value = '';
    if(adminServiceTravelCodeDisplayElement) adminServiceTravelCodeDisplayElement.value = 'None selected';
    renderAdminServiceRateFields(); // This will clear and re-render based on default category
    currentAdminServiceEditingId = null;
}
function openTravelCodeSelectionModal() { 
    openModal('travelCodeSelectionModal'); 
    if(travelCodeListContainerElement) {
        travelCodeListContainerElement.innerHTML = '';
        const travelServices = adminManagedServices.filter(s => s.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM);
        if (travelServices.length === 0) {
            travelCodeListContainerElement.innerHTML = '<p class="list-group-item">No travel services defined. Please add them in the NDIS Services tab first.</p>';
        } else {
            travelServices.forEach(ts => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'list-group-item list-group-item-action';
                item.textContent = `${ts.description} (${ts.serviceCode})`;
                item.dataset.travelServiceId = ts.id;
                item.addEventListener('click', () => {
                    if(adminServiceTravelCodeInputElement) adminServiceTravelCodeInputElement.value = ts.id;
                    if(adminServiceTravelCodeDisplayElement) adminServiceTravelCodeDisplayElement.value = `${ts.description} (${ts.serviceCode})`;
                    closeModal('travelCodeSelectionModal');
                });
                travelCodeListContainerElement.appendChild(item);
            });
        }
    }
}
function renderAdminServiceRateFields() { 
    if(!adminServiceRateFieldsContainerElement || !adminServiceCategoryTypeSelectElement) return;
    adminServiceRateFieldsContainerElement.innerHTML = ''; // Clear existing
    const category = adminServiceCategoryTypeSelectElement.value;
    let rateKeysToShow = [];

    if (category === SERVICE_CATEGORY_TYPES.CORE_STANDARD || category === SERVICE_CATEGORY_TYPES.CORE_HIGH_INTENSITY) {
        rateKeysToShow = RATE_CATEGORIES; // weekday, evening, night, saturday, sunday, public
    } else if (category === SERVICE_CATEGORY_TYPES.CAPACITY_THERAPY_STD || category === SERVICE_CATEGORY_TYPES.CAPACITY_SPECIALIST || category === SERVICE_CATEGORY_TYPES.TRAVEL_KM || category === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
        rateKeysToShow = ['flat']; // Single flat rate
    }
    // Add more conditions if other categories have specific rate structures

    if (rateKeysToShow.length > 0) {
        const gridDiv = document.createElement('div');
        gridDiv.className = 'row g-2'; // Bootstrap grid
        rateKeysToShow.forEach(key => {
            const colDiv = document.createElement('div');
            colDiv.className = 'col-md-4 col-sm-6'; // Responsive columns
            const label = document.createElement('label');
            label.htmlFor = `adminServiceRate_${key}`;
            label.className = 'form-label-sm text-capitalize';
            label.textContent = `${key.replace('_', ' ')} Rate ($):`;
            const input = document.createElement('input');
            input.type = 'number';
            input.id = `adminServiceRate_${key}`;
            input.dataset.rateKey = key;
            input.className = 'form-control form-control-sm';
            input.step = '0.01';
            input.placeholder = '0.00';
            colDiv.appendChild(label);
            colDiv.appendChild(input);
            gridDiv.appendChild(colDiv);
        });
        adminServiceRateFieldsContainerElement.appendChild(gridDiv);
    }
}
function renderAdminAgreementCustomizationTab() { /* ... populate fields ... */ }
function renderAdminAgreementClausesEditor() { /* ... same logic ... */ }
function addAdminAgreementClauseEditor(clause = {}) { /* ... same logic ... */ }
function updateAdminAgreementPreview() { /* ... same logic ... */ }
async function saveAdminAgreementCustomizationsToFirestore() { /* ... same logic ... */ }
function renderAdminWorkerManagementTab() { 
    // Worker approval UI and logic is removed.
    loadApprovedWorkersForAuthManagement(); 
}
async function loadApprovedWorkersForAuthManagement() {
    if(!workersListForAuthSelectElement) return;
    workersListForAuthSelectElement.innerHTML = '<option value="">-- Select Worker --</option>';
    Object.values(allUsersCache).filter(u => !u.isAdmin) // No u.approved check needed anymore
        .forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.uid; opt.textContent = `${w.name || w.email}`;
            workersListForAuthSelectElement.appendChild(opt);
        });
 }
function selectWorkerForAuth(uid, name) {
    const worker = allUsersCache[uid];
    if (!worker) return;
    selectedWorkerEmailForAuth = worker.email; 
    if(selectedWorkerNameForAuthElement) selectedWorkerNameForAuthElement.textContent = `Manage Services for: ${name || selectedWorkerEmailForAuth}`;
    if(servicesListCheckboxesElement) {
        servicesListCheckboxesElement.innerHTML = ''; 
        adminManagedServices.forEach(service => {
            const isAuthorized = worker.authorizedServices?.includes(service.id);
            servicesListCheckboxesElement.innerHTML += `
                <div class="form-check">
                    <input class="form-check-input service-auth-checkbox" type="checkbox" value="${service.id}" id="auth_serv_${service.id}" ${isAuthorized ? 'checked' : ''}>
                    <label class="form-check-label" for="auth_serv_${service.id}">${service.description} (${service.serviceCode})</label>
                </div>`;
        });
    }
    if(servicesForWorkerContainerElement) servicesForWorkerContainerElement.classList.remove('d-none');
 }
async function saveWorkerAuthorizationsToFirestore() { 
    if (!selectedWorkerEmailForAuth) { showMessage("Error", "No worker selected.", "warning"); return; }
    const selectedWorker = Object.values(allUsersCache).find(u => u.email === selectedWorkerEmailForAuth);
    if (!selectedWorker || !selectedWorker.uid) { showMessage("Error", "Selected worker not found.", "error"); return; }

    const authorizedServices = [];
    servicesListCheckboxesElement.querySelectorAll('.service-auth-checkbox:checked').forEach(cb => authorizedServices.push(cb.value));
    
    showLoading("Saving authorizations...");
    try {
        await updateDoc(doc(fsDb, `artifacts/${appId}/users/${selectedWorker.uid}/profile`, "details"), { authorizedServices, updatedAt: serverTimestamp() });
        allUsersCache[selectedWorker.uid].authorizedServices = authorizedServices; 
        showMessage("Authorizations Saved", "Worker service authorizations updated.", "success");
    } catch (e) { logErrorToFirestore("saveWorkerAuthorizations", e.message, e); showMessage("Save Failed", e.message, "error");}
    finally { hideLoading(); }
}

// Expose Alpine.js component functions to the global scope
window.portalApp = function() {
    return {
        // This can be expanded if the main body needs reactive properties
        // For now, it's mainly a placeholder to initialize Alpine on the body
    };
}

window.userSetupWizard = function() {
    return {
        currentStep: 1, totalSteps: 4, wizardTitle: 'Setup Progress',
        wizardFilesStaged: [],
        nextStep() { if (this.currentStep < this.totalSteps) this.currentStep++; this.updateTitle(); },
        prevStep() { if (this.currentStep > 1) this.currentStep--; this.updateTitle(); },
        updateTitle() { this.wizardTitle = `Profile Setup - Step ${this.currentStep}`; },
        handleWizardFiles(event) { this.wizardFilesStaged = Array.from(event.target.files); },
        async finishUserWizard() { 
            const name = $('#wName').value; const abn = $('#wAbn').value; const gst = $('#wGst').checked;
            const bsb = $('#wBsb').value; const acc = $('#wAcc').value;
            const profileUpdates = { name, abn, gstRegistered: gst, bsb, acc, profileSetupComplete: true };
            await saveProfileDetails(profileUpdates);
            
            if (this.wizardFilesStaged.length > 0 && profileFileUploadElement) {
                // Create a new FileList for the input
                const dataTransfer = new DataTransfer();
                this.wizardFilesStaged.forEach(file => dataTransfer.items.add(file));
                profileFileUploadElement.files = dataTransfer.files;
                await uploadProfileDocuments();
            }
            closeModal('wizModal'); 
        }
    };
}

window.adminSetupWizard = function() {
    return {
        currentStep: 1, totalSteps: 3, wizardTitle: 'Portal Setup', portalType: 'organization',
        nextStep() { if (this.currentStep < this.totalSteps) this.currentStep++; this.updateTitle(); },
        prevStep() { if (this.currentStep > 1) this.currentStep--; this.updateTitle(); },
        updateTitle() { this.wizardTitle = `Portal Setup - Step ${this.currentStep}`; },
        async finishAdminWizard() { 
            globalSettings.portalType = this.portalType;
            if (this.portalType === 'organization') {
                globalSettings.organizationName = $('#adminWizOrgName').value;
                globalSettings.organizationAbn = $('#adminWizOrgAbn').value;
                globalSettings.organizationContactEmail = $('#adminWizOrgContactEmail').value;
                globalSettings.organizationContactPhone = $('#adminWizOrgContactPhone').value;
            } else { 
                if (userProfile && $('#adminWizUserName')) { // Update current admin's name if individual setup
                     userProfile.name = $('#adminWizUserName').value || userProfile.name; 
                     await saveProfileDetails({name: userProfile.name}); 
                }
            }
            globalSettings.defaultParticipantName = $('#adminWizParticipantName').value;
            globalSettings.defaultParticipantNdisNo = $('#adminWizParticipantNdisNo').value;
            globalSettings.defaultPlanManagerName = $('#adminWizPlanManagerName').value;
            globalSettings.defaultPlanManagerEmail = $('#adminWizPlanManagerEmail').value;
            globalSettings.defaultPlanManagerPhone = $('#adminWizPlanManagerPhone').value;
            globalSettings.defaultPlanEndDate = $('#adminWizPlanEndDate').value;
            globalSettings.setupComplete = true; 
            await saveGlobalSettingsToFirestore(); 
            closeModal('adminSetupWizardModal'); 
            updatePortalTitle(); 
            if(userProfile.isAdmin) renderAdminGlobalSettingsTab();
        }
    };
}


/* ========== Event Listeners Setup ========== */
function setupEventListeners() {
    loginButtonElement?.addEventListener('click', modalLogin);
    registerButtonElement?.addEventListener('click', modalRegister);
    logoutButtonElement?.addEventListener('click', portalSignOut);
    
    $$("nav#side .nav-link, nav#bottom .nav-link").forEach(a => {
        a.addEventListener('click', e => { e.preventDefault(); if (a.hash) navigateToSection(a.hash.substring(1)); });
    });
    window.addEventListener('hashchange', () => { navigateToSection(window.location.hash.substring(1) || 'home'); });
    
    editProfileButtonElement?.addEventListener('click', () => openModal('wizModal')); 
    uploadProfileDocumentsButtonElement?.addEventListener('click', uploadProfileDocuments);
    profileFilesListElement?.addEventListener('click', (e) => { 
        if (e.target.closest('.delete-profile-doc-btn')) {
            const btn = e.target.closest('.delete-profile-doc-btn');
            requestDeleteProfileDocument(btn.dataset.filename, btn.dataset.filepath);
        }
    });

    addInvoiceRowButtonElement?.addEventListener('click', addInvRowUserAction);
    saveDraftButtonElement?.addEventListener('click', saveInvoiceDraft);
    generateInvoicePdfButtonElement?.addEventListener('click', generateInvoicePdf);
    saveInitialInvoiceNumberButtonElement?.addEventListener('click', saveInitialInvoiceNumber);
    if(gstFlagInputElement) gstFlagInputElement.addEventListener('change', updateInvoiceTotals);
    invoiceTableBodyElement?.addEventListener('click', (e) => {
      if (e.target.closest('.delete-invoice-row-btn')) {
          requestDeleteInvoiceRow(e.target.closest('.delete-invoice-row-btn'));
      }
    });

    signAgreementButtonElement?.addEventListener('click', () => openSignatureModal('worker'));
    participantSignButtonElement?.addEventListener('click', () => openSignatureModal('participant'));
    downloadAgreementPdfButtonElement?.addEventListener('click', generateAgreementPdf);
    saveSignatureButtonElement?.addEventListener('click', saveSignature);
    clearSignatureButtonElement?.addEventListener('click', clearSignaturePad);
    loadServiceAgreementForSelectedWorkerButtonElement?.addEventListener('click', () => {
        if (adminSelectWorkerForAgreementElement?.value) loadAndRenderServiceAgreement(adminSelectWorkerForAgreementElement.value);
        else showMessage("Selection Missing", "Select a worker.", "warning");
    });

    saveAdminPortalSettingsButtonElement?.addEventListener('click', saveAdminPortalSettings);
    resetGlobalSettingsToDefaultsButtonElement?.addEventListener('click', requestResetGlobalSettings);
    copyInviteLinkButtonElement?.addEventListener('click', () => {
        if (inviteLinkCodeElement?.value) {
            navigator.clipboard.writeText(inviteLinkCodeElement.value)
                .then(() => showMessage("Copied!", "Invite link copied.", "success"))
                .catch(err => showMessage("Copy Failed", "Could not copy.", "error"));
        }
    });

    saveAdminServiceButtonElement?.addEventListener('click', saveAdminServiceToFirestore);
    clearAdminServiceFormButtonElement?.addEventListener('click', clearAdminServiceForm);
    selectTravelCodeButtonElement?.addEventListener('click', openTravelCodeSelectionModal);
    adminServiceCategoryTypeSelectElement?.addEventListener('change', renderAdminServiceRateFields);
    confirmTravelCodeSelectionButtonElement?.addEventListener('click', () => { closeModal('travelCodeSelectionModal');});
    adminServicesTableBodyElement?.addEventListener('click', handleAdminServiceAction); 

    adminAddAgreementClauseButtonElement?.addEventListener('click', () => addAdminAgreementClauseEditor());
    saveAdminAgreementCustomizationsButtonElement?.addEventListener('click', saveAdminAgreementCustomizationsToFirestore);
    adminAgreementOverallTitleInputElement?.addEventListener('input', updateAdminAgreementPreview);
    adminAgreementClausesContainerElement?.addEventListener('input', (e) => { if(e.target.matches('textarea, input')) updateAdminAgreementPreview(); });

    workersListForAuthSelectElement?.addEventListener('change', (e) => {
        if (e.target.value) {
            const selectedUser = allUsersCache[e.target.value];
            selectWorkerForAuth(e.target.value, selectedUser?.name || selectedUser?.email);
        } else {
            if(servicesForWorkerContainerElement) servicesForWorkerContainerElement.classList.add('d-none');
            if(selectedWorkerNameForAuthElement) selectedWorkerNameForAuthElement.textContent = 'Select an Approved Worker';
        }
    });
    saveWorkerAuthorizationsButtonElement?.addEventListener('click', saveWorkerAuthorizationsToFirestore);
    
    requestShiftButtonElement?.addEventListener('click', () => openModal('rqModal'));
    saveRequestButtonElement?.addEventListener('click', () => { /* TODO: Add save shift request logic */ closeModal('rqModal'); showMessage("Request Submitted", "Shift request submitted.", "success"); });
    
    logTodayShiftButtonElement?.addEventListener('click', () => openModal('logShiftModal'));
    saveShiftToInvoiceButtonElement?.addEventListener('click', () => { /* TODO: Add save shift to invoice logic */ closeModal('logShiftModal'); showMessage("Shift Logged", "Shift added to invoice draft.", "success"); });
    
    initFlatpickr(); // Initialize Flatpickr for static elements
}

function initFlatpickr() {
    flatpickr(".flatpickr-date", { dateFormat: "Y-m-d", allowInput: true });
    flatpickr(".flatpickr-time", { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, allowInput: true });
    const invDateElem = document.getElementById('invDate');
    if (invDateElem) {
        flatpickr(invDateElem, {
            dateFormat: "Y-m-d", allowInput: true,
            onChange: function(selectedDates, dateStr, instance) {
                if (invoiceWeekLabelElement && dateStr) invoiceWeekLabelElement.textContent = getWeekNumber(selectedDates[0]);
            }
        });
    }
}
function initFlatpickrForRow(rowElement) { 
    rowElement.querySelectorAll(".flatpickr-date").forEach(el => flatpickr(el, { dateFormat: "Y-m-d", allowInput: true }));
    rowElement.querySelectorAll(".flatpickr-time").forEach(el => flatpickr(el, { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, allowInput: true }));
}

/* ========== App Initialization ========== */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded. App Version 1.2.1-libs-fix");
    showLoading("Initializing Portal...");
    
    // Make Alpine component functions globally available
    window.portalApp = portalApp;
    window.userSetupWizard = userSetupWizard;
    window.adminSetupWizard = adminSetupWizard;

    // Initialize Bootstrap Modals that are always in the DOM
    if (document.getElementById('loadingOverlay')) loadingOverlayInstance = new bootstrap.Modal(document.getElementById('loadingOverlay'), { keyboard: false, backdrop: 'static' });
    if (document.getElementById('messageModal')) messageModalInstance = new bootstrap.Modal(document.getElementById('messageModal'));
    if (document.getElementById('confirmationModal')) confirmationModalInstance = new bootstrap.Modal(document.getElementById('confirmationModal'));
    // Wizard modals are controlled by Alpine, but we can get their instances if needed for JS control
    if (document.getElementById('wizModal')) userSetupWizardModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('wizModal'));
    if (document.getElementById('adminSetupWizardModal')) adminSetupWizardModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('adminSetupWizardModal'));

    await initializeFirebaseApp();
    setupEventListeners(); 

    if (!initialAuthComplete) {
        console.log("Waiting for onAuthStateChanged for initial navigation.");
    }
    console.log("[AppInit] DOMContentLoaded complete.");
});
