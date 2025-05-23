// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as fbSignOut, // Renamed to avoid conflict
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
    addDoc as fsAddDoc // Renamed to avoid conflict
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

/* ========== DOM Helper Functions ========== */
const $ = q => document.querySelector(q);
const $$ = q => Array.from(document.querySelectorAll(q));

/* ========== Firebase Global Variables & Config ========== */
let fbApp;
let fbAuth;
let fsDb;
let fbStorage;
let currentUserId = null;
let currentUserEmail = null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ndis-portal-app-local';
console.log(`[App Init] Using appId: ${appId}`);

/* ========== UI Element References ========== */
const authScreenElement = $("#authScreen"), portalAppElement = $("#portalApp"), loadingOverlayElement = $("#loadingOverlay");
const authEmailInputElement = $("#authEmail"), authPasswordInputElement = $("#authPassword"), authStatusMessageElement = $("#authStatusMessage");
const loginButtonElement = $("#loginBtn"), registerButtonElement = $("#registerBtn"), logoutButtonElement = $("#logoutBtn");
const userIdDisplayElement = $("#userIdDisplay"), portalTitleDisplayElement = $("#portalTitleDisplay");
const sideNavLinks = $$("nav#side a.link"), bottomNavLinks = $$("nav#bottom a.bLink"), adminTabElement = $("#adminTab");
const homeUserDivElement = $("#homeUser"), userNameDisplayElement = $("#userNameDisplay"), requestShiftButtonElement = $("#rqBtn"), logTodayShiftButtonElement = $("#logTodayShiftBtn");
const shiftRequestsTableBodyElement = $("#rqTbl tbody");
const profileNameElement = $("#profileName"), profileAbnElement = $("#profileAbn"), profileGstElement = $("#profileGst"), profileBsbElement = $("#profileBsb"), profileAccElement = $("#profileAcc");
const profileFilesListElement = $("#profileFilesList"), profileFileUploadElement = $("#profileFileUpload"), uploadProfileDocumentsButtonElement = $("#uploadProfileDocumentsBtn"), editProfileButtonElement = $("#editProfileBtn");
const setInitialInvoiceModalElement = $("#setInitialInvoiceModal"), initialInvoiceNumberInputElement = $("#initialInvoiceNumberInput"), saveInitialInvoiceNumberButtonElement = $("#saveInitialInvoiceNumberBtn");
const invoiceWeekLabelElement = $("#wkLbl"), invoiceNumberInputElement = $("#invNo"), invoiceDateInputElement = $("#invDate");
const providerNameInputElement = $("#provName"), providerAbnInputElement = $("#provAbn"), gstFlagInputElement = $("#gstFlag");
const invoiceTableBodyElement = $("#invTbl tbody"), subtotalElement = $("#sub"), gstRowElement = $("#gstRow"), gstAmountElement = $("#gst"), grandTotalElement = $("#grand");
const addInvoiceRowButtonElement = $("#addInvRowUserActionBtn"), saveDraftButtonElement = $("#saveDraftBtn"), generateInvoicePdfButtonElement = $("#generateInvoicePdfBtn"), invoicePdfContentElement = $("#invoicePdfContent");
const agreementDynamicTitleElement = $("#agreementDynamicTitle"), adminAgreementWorkerSelectorElement = $("#adminAgreementWorkerSelector"), adminSelectWorkerForAgreementElement = $("#adminSelectWorkerForAgreement"), loadServiceAgreementForSelectedWorkerButtonElement = $("#loadServiceAgreementForSelectedWorkerBtn");
const agreementChipElement = $("#agrChip"), agreementContentContainerElement = $("#agreementContentContainer"), participantSignatureImageElement = $("#sigP"), participantSignatureDateElement = $("#dP");
const workerSignatureImageElement = $("#sigW"), workerSignatureDateElement = $("#dW"), signAgreementButtonElement = $("#signBtn"), participantSignButtonElement = $("#participantSignBtn"), downloadAgreementPdfButtonElement = $("#pdfBtn"), agreementContentWrapperElement = $("#agreementContentWrapper"), agreementHeaderForPdfElement = $("#agreementHeaderForPdf");
const adminNavTabButtons = $$(".admin-tab-btn"), adminContentPanels = $$(".admin-content-panel");
const adminEditOrgNameInputElement = $("#adminEditOrgName"), adminEditOrgAbnInputElement = $("#adminEditOrgAbn"), adminEditOrgContactEmailInputElement = $("#adminEditOrgContactEmail"), adminEditOrgContactPhoneInputElement = $("#adminEditOrgContactPhone");
const adminEditParticipantNameInputElement = $("#adminEditParticipantName"), adminEditParticipantNdisNoInputElement = $("#adminEditParticipantNdisNo"), adminEditPlanManagerNameInputElement = $("#adminEditPlanManagerName"), adminEditPlanManagerEmailInputElement = $("#adminEditPlanManagerEmail"), adminEditPlanManagerPhoneInputElement = $("#adminEditPlanManagerPhone"), adminEditPlanEndDateInputElement = $("#adminEditPlanEndDate");
const saveAdminPortalSettingsButtonElement = $("#saveAdminPortalSettingsBtn"), resetGlobalSettingsToDefaultsButtonElement = $("#resetGlobalSettingsToDefaultsBtn"), inviteLinkCodeElement = $("#invite"), copyInviteLinkButtonElement = $("#copyLinkBtn");
const adminServiceIdInputElement = $("#adminServiceId"), adminServiceCodeInputElement = $("#adminServiceCode"), adminServiceDescriptionInputElement = $("#adminServiceDescription"), adminServiceCategoryTypeSelectElement = $("#adminServiceCategoryType");
const adminServiceRateFieldsContainerElement = $("#adminServiceRateFieldsContainer"), adminServiceTravelCodeDisplayElement = $("#adminServiceTravelCodeDisplay"), selectTravelCodeButtonElement = $("#selectTravelCodeBtn"), adminServiceTravelCodeInputElement = $("#adminServiceTravelCode");
const saveAdminServiceButtonElement = $("#saveAdminServiceBtn"), clearAdminServiceFormButtonElement = $("#clearAdminServiceFormBtn"), adminServicesTableBodyElement = $("#adminServicesTable tbody");
const adminAgreementOverallTitleInputElement = $("#adminAgreementOverallTitle"), adminAgreementClausesContainerElement = $("#adminAgreementClausesContainer"), adminAddAgreementClauseButtonElement = $("#adminAddAgreementClauseBtn"), saveAdminAgreementCustomizationsButtonElement = $("#saveAdminAgreementCustomizationsBtn"), adminAgreementPreviewElement = $("#adminAgreementPreview");
const pendingWorkersListElement = $("#pendingWorkersList"), noPendingWorkersMessageElement = $("#noPendingWorkersMessage"), workersListForAuthElement = $("#workersListForAuth"), selectedWorkerNameForAuthElement = $("#selectedWorkerNameForAuth"), servicesForWorkerContainerElement = $("#servicesForWorkerContainer"), servicesListCheckboxesElement = $("#servicesListCheckboxes"), saveWorkerAuthorizationsButtonElement = $("#saveWorkerAuthorizationsBtn");
const requestShiftModalElement = $("#rqModal"), requestDateInputElement = $("#rqDate"), requestStartTimeInputElement = $("#rqStart"), requestEndTimeInputElement = $("#rqEnd"), requestReasonTextareaElement = $("#rqReason"), saveRequestButtonElement = $("#saveRequestBtn"), closeRequestModalButtonElement = $("#closeRqModalBtn");
const logShiftModalElement = $("#logShiftModal"), logShiftDateInputElement = $("#logShiftDate"), logShiftSupportTypeSelectElement = $("#logShiftSupportType"), logShiftStartTimeInputElement = $("#logShiftStartTime"), logShiftEndTimeInputElement = $("#logShiftEndTime"), logShiftClaimTravelToggleElement = $("#logShiftClaimTravelToggle"), logShiftKmFieldsContainerElement = $("#logShiftKmFieldsContainer"), logShiftStartKmInputElement = $("#logShiftStartKm"), logShiftEndKmInputElement = $("#logShiftEndKm"), logShiftCalculatedKmElement = $("#logShiftCalculatedKm"), saveShiftToInvoiceButtonElement = $("#saveShiftFromModalToInvoiceBtn"), closeLogShiftModalButtonElement = $("#closeLogShiftModalBtn");
const signatureModalElement = $("#sigModal"), signatureCanvasElement = $("#signatureCanvas"), saveSignatureButtonElement = $("#saveSigBtn"), closeSignatureModalButtonElement = $("#closeSigModalBtn");
const userSetupWizardModalElement = $("#wiz"), userWizardStepElements = $$("#wiz .wizard-step-content"), userWizardIndicatorElements = $$("#wiz .wizard-step-indicator");
const wizardNameInputElement = $("#wName"), wizardAbnInputElement = $("#wAbn"), wizardGstCheckboxElement = $("#wGst"), wizardNextButton1Element = $("#wizNextBtn1");
const wizardBsbInputElement = $("#wBsb"), wizardAccInputElement = $("#wAcc"), wizardPrevButton2Element = $("#wizPrevBtn2"), wizardNextButton2Element = $("#wizNextBtn2");
const wizardFilesInputElement = $("#wFiles"), wizardFilesListElement = $("#wFilesList"), wizardPrevButton3Element = $("#wizPrevBtn3"), wizardNextButton3Element = $("#wizNextBtn3");
const wizardPrevButton4Element = $("#wizPrevBtn4"), wizardFinishButtonElement = $("#wizFinishBtn");
const adminSetupWizardModalElement = $("#adminSetupWizard"), adminWizardStepElements = $$("#adminSetupWizard .wizard-step-content"), adminWizardIndicatorElements = $$("#adminSetupWizard .wizard-step-indicator");
const adminWizardPortalTypeRadioElements = $$("input[name='adminWizPortalType']"), adminWizardNextButton1Element = $("#adminWizNextBtn1");
const adminWizardOrgNameInputElement = $("#adminWizOrgName"), adminWizardOrgAbnInputElement = $("#adminWizOrgAbn"), adminWizardOrgContactEmailInputElement = $("#adminWizOrgContactEmail"), adminWizardOrgContactPhoneInputElement = $("#adminWizOrgContactPhone");
const adminWizardUserNameInputElement = $("#adminWizUserName"), adminWizardPrevButton2Element = $("#adminWizPrevBtn2"), adminWizardNextButton2Element = $("#adminWizNextBtn2");
const adminWizardParticipantNameInputElement = $("#adminWizParticipantName"), adminWizardParticipantNdisNoInputElement = $("#adminWizParticipantNdisNo"), adminWizardPlanManagerNameInputElement = $("#adminWizPlanManagerName"), adminWizardPlanManagerEmailInputElement = $("#adminWizPlanManagerEmail"), adminWizardPlanManagerPhoneInputElement = $("#adminWizPlanManagerPhone"), adminWizardPlanEndDateInputElement = $("#adminWizPlanEndDate");
const adminWizardPrevButton3Element = $("#adminWizPrevBtn3"), adminWizardFinishButtonElement = $("#adminWizFinishBtn");
const customTimePickerElement = $("#customTimePicker"), timePickerAmPmButtonsContainerElement = $("#timePickerAmPmButtons"), timePickerHoursContainerElement = $("#timePickerHours"), timePickerMinutesContainerElement = $("#timePickerMinutes"), timePickerBackButtonElement = $("#timePickerBackButton"), setTimeButtonElement = $("#setTimeButton"), cancelTimeButtonElement = $("#cancelTimeButton"), currentTimePickerStepLabelElement = $("#currentTimePickerStepLabel");
const messageModalElement = $("#messageModal"), messageModalTitleElement = $("#messageModalTitle"), messageModalTextElement = $("#messageModalText"), closeMessageModalButtonElement = $("#closeMessageModalBtn");
const travelCodeSelectionModalElement = $("#travelCodeSelectionModal"), travelCodeFilterInputElement = $("#travelCodeFilterInput"), travelCodeListContainerElement = $("#travelCodeListContainer"), confirmTravelCodeSelectionButtonElement = $("#confirmTravelCodeSelectionBtn"), closeTravelCodeSelectionModalButtonElement = $("#closeTravelCodeSelectionModalBtn");

/* ========== Local State Variables ========== */
let userProfile = {};
let globalSettings = {};
let adminManagedServices = [];
let currentInvoiceData = { items: [], invoiceNumber: "", invoiceDate: "", subtotal: 0, gst: 0, grandTotal: 0 };
let agreementCustomData = {}; // Will be loaded or set to default
let defaultAgreementCustomData = { // Default structure
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
let currentAgreementWorkerEmail = null;
let signingAs = 'worker';
let isFirebaseInitialized = false, initialAuthComplete = false;
let selectedWorkerEmailForAuth = null;
let currentAdminServiceEditingId = null;
let currentTimePickerStep, selectedMinute, selectedHour12, selectedAmPm, activeTimeInput, timePickerCallback;
let currentAdminWizardStep = 1, currentUserWizardStep = 1;
let wizardFileUploads = [];
let allUsersCache = {}; // Cache for admin lookups

/* ========== Error Logging ========== */
async function logErrorToFirestore(location, errorMsg, errorDetails = {}) {
    if (!fsDb || !appId || appId === 'ndis-portal-app-local') { console.error("Firestore not init/local dev, no log:", location, errorMsg, errorDetails); return; }
    try {
        await fsAddDoc(collection(fsDb, `artifacts/${appId}/public/logs/errors`), {
            location: String(location), errorMessage: String(errorMsg),
            errorStack: errorDetails instanceof Error ? errorDetails.stack : JSON.stringify(errorDetails),
            user: currentUserEmail || currentUserId || "unknown", timestamp: serverTimestamp(),
            appVersion: "1.0.8", userAgent: navigator.userAgent, url: window.location.href
        });
        console.info("Error logged:", location);
    } catch (logError) { console.error("FATAL: Could not log error:", logError, "Original:", location, errorMsg); }
}

/* ========== UI Helpers ========== */
function showLoading(message = "Loading...") { if (loadingOverlayElement) { loadingOverlayElement.querySelector('p').textContent = message; loadingOverlayElement.style.display = "flex"; } }
function hideLoading() { if (loadingOverlayElement) loadingOverlayElement.style.display = "none"; }
function showAuthStatusMessage(message, isError = true) { if (authStatusMessageElement) { authStatusMessageElement.textContent = message; authStatusMessageElement.style.color = isError ? 'var(--danger)' : 'var(--ok)'; authStatusMessageElement.style.display = message ? 'block' : 'none'; } }
function showMessage(title, text, type = 'info') {
    const iconClass = type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
    if (messageModalTitleElement) messageModalTitleElement.innerHTML = `<i class="fas ${iconClass}"></i> ${title}`;
    if (messageModalTextElement) messageModalTextElement.innerHTML = text;
    if (messageModalElement) messageModalElement.style.display = "flex";
}
function openModal(modalId) { const modal = $(`#${modalId}`); if (modal) modal.style.display = 'flex'; }
function closeModal(modalId) { const modal = $(`#${modalId}`); if (modal) modal.style.display = 'none'; }

/* ========== Utilities ========== */
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase()); }
function formatDateForDisplay(d) { if (!d) return ""; try { const date = d.toDate ? d.toDate() : new Date(d); return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return "Invalid"; } }
function formatDateForInput(d) { if (!d) return ""; try { const date = d.toDate ? d.toDate() : new Date(d); const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), day = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; } catch (e) { return ""; } }
function timeToMinutes(t) { if (!t || !t.includes(':')) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function calculateHours(s, e) { if (!s || !e) return 0; const diff = timeToMinutes(e) - timeToMinutes(s); return diff > 0 ? parseFloat((diff / 60).toFixed(2)) : 0; }
function determineRateType(dStr, sTime) { if (!dStr || !sTime) return "weekday"; const d = new Date(`${dStr}T${sTime}:00`); const day = d.getDay(), hr = d.getHours(); if (day === 0) return "sunday"; if (day === 6) return "saturday"; if (hr >= 20 || hr < 6) return "night"; return "weekday"; }
function formatTime12Hour(t24) { if (!t24 || !t24.includes(':')) return ""; const [h, m] = t24.split(':'); const hr = parseInt(h, 10); const ap = hr >= 12 ? 'PM' : 'AM'; let hr12 = hr % 12; hr12 = hr12 ? hr12 : 12; return `${String(hr12).padStart(2, '0')}:${m} ${ap}`; }
function formatCurrency(n) { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n || 0); }
function generateUniqueId() { return Date.now().toString(36) + Math.random().toString(36).substring(2); }
function getWeekNumber(d) { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); const yS = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil((((d - yS) / 86400000) + 1) / 7); }

/* ========== Firebase Initialization & Auth ========== */
async function initializeFirebaseApp() {
    console.log("[FirebaseInit] Initializing...");
    const config = window.firebaseConfigForApp;
    if (!config || !config.apiKey || config.apiKey.startsWith("YOUR_")) {
        showAuthStatusMessage("System Error: Portal configuration invalid."); hideLoading(); return;
    }
    try {
        fbApp = initializeApp(config, appId);
        fbAuth = getAuth(fbApp); fsDb = getFirestore(fbApp); fbStorage = getStorage(fbApp);
        isFirebaseInitialized = true; console.log("[FirebaseInit] Success.");
        await setupAuthListener();
    } catch (error) { console.error("[FirebaseInit] Error:", error); logErrorToFirestore("initializeFirebaseApp", error.message, error); showAuthStatusMessage("System Error: " + error.message); hideLoading(); }
}

async function setupAuthListener() {
    return new Promise((resolve) => {
        onAuthStateChanged(fbAuth, async (user) => {
            showLoading("Authenticating...");
            try {
                if (user) {
                    currentUserId = user.uid; currentUserEmail = user.email;
                    console.log("[AuthListener] User authenticated:", currentUserId, currentUserEmail);
                    if(userIdDisplayElement) userIdDisplayElement.textContent = currentUserEmail || currentUserId;
                    if(logoutButtonElement) logoutButtonElement.classList.remove('hide');
                    if(authScreenElement) authScreenElement.style.display = "none";
                    if(portalAppElement) portalAppElement.style.display = "flex";
                    await loadGlobalSettingsFromFirestore();
                    const profileData = await loadUserProfileFromFirestore(currentUserId);
                    let signedOut = false;
                    if (profileData) { signedOut = await handleExistingUserProfile(profileData); }
                    else if (currentUserEmail && currentUserEmail.toLowerCase() === "admin@portal.com") { signedOut = await handleNewAdminProfile(); }
                    else if (currentUserId) { signedOut = await handleNewRegularUserProfile(); }
                    else { await fbSignOut(fbAuth); signedOut = true; }
                    if (signedOut) console.log("[AuthListener] User flow led to sign out.");
                } else {
                    console.log("[AuthListener] User signed out.");
                    currentUserId = null; currentUserEmail = null; userProfile = {};
                    if(userIdDisplayElement) userIdDisplayElement.textContent = "Not Logged In";
                    if(logoutButtonElement) logoutButtonElement.classList.add('hide');
                    if(authScreenElement) authScreenElement.style.display = "flex";
                    if(portalAppElement) portalAppElement.style.display = "none";
                    updateNavigation(false); navigateToSection("home");
                }
            } catch (error) { console.error("[AuthListener] Error:", error); logErrorToFirestore("onAuthStateChanged", error.message, error); await fbSignOut(fbAuth); }
            finally { hideLoading(); if (!initialAuthComplete) { initialAuthComplete = true; resolve(); } }
        });
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            signInWithCustomToken(fbAuth, __initial_auth_token).catch(e => { console.error("Token sign-in error:", e); logErrorToFirestore("signInWithCustomToken", e.message, e); });
        } else { console.log("[AuthListener] No token, waiting for state change or login."); }
    });
}

async function handleExistingUserProfile(data) {
    userProfile = data;
    console.log(`[Auth] Existing profile. Approved: ${userProfile.approved}, Admin: ${userProfile.isAdmin}`);
    if (!userProfile.isAdmin && globalSettings.portalType === 'organization' && !userProfile.approved) {
        showMessage("Approval Required", "Your account awaits approval. Logging out.", "warning");
        await fbSignOut(fbAuth); return true;
    }
    if (userProfile.isAdmin) { await loadAllDataForAdmin(); enterPortal(true); }
    else { await loadAllDataForUser(); enterPortal(false); }
    return false;
}

async function handleNewAdminProfile() {
    console.log("[Auth] New admin login.");
    userProfile = { isAdmin: true, name: "Administrator", email: currentUserEmail, uid: currentUserId, approved: true, createdAt: serverTimestamp(), profileSetupComplete: true, nextInvoiceNumber: 1001 };
    await setDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), userProfile);
    await loadAllDataForAdmin(); enterPortal(true);
    if (!globalSettings.setupComplete) openAdminSetupWizard();
    return false;
}

async function handleNewRegularUserProfile() {
    console.log("[Auth] New regular user.");
    const isOrg = globalSettings.portalType === 'organization';
    userProfile = { name: currentUserEmail.split('@')[0], email: currentUserEmail, uid: currentUserId, isAdmin: false, approved: !isOrg, profileSetupComplete: false, nextInvoiceNumber: 1001, createdAt: serverTimestamp() };
    await setDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), userProfile);
    if (isOrg && !userProfile.approved) {
        showMessage("Registration Complete", "Your account awaits approval. Logging out.", "info");
        await fbSignOut(fbAuth); return true;
    }
    await loadAllDataForUser(); enterPortal(false);
    if (!userProfile.profileSetupComplete) openUserSetupWizard();
    return false;
}

/* ========== Data Loading & Saving ========== */
async function loadUserProfileFromFirestore(uid) {
    try { const snap = await getDoc(doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details")); return snap.exists() ? snap.data() : null; }
    catch (e) { console.error("Profile Load Error:", e); logErrorToFirestore("loadUserProfile", e.message, e); return null; }
}

function getDefaultGlobalSettings() {
    return { portalTitle: "NDIS Support Portal", organizationName: "Org Name", organizationAbn: "ABN", organizationContactEmail: "contact@example.com", organizationContactPhone: "000-000-000", defaultParticipantName: "Participant Name", defaultParticipantNdisNo: "000000000", defaultPlanManagerName: "PM Name", defaultPlanManagerEmail: "pm@example.com", defaultPlanManagerPhone: "111-111-111", defaultPlanEndDate: formatDateForInput(new Date(new Date().setFullYear(new Date().getFullYear() + 1))), setupComplete: false, portalType: "organization", agreementTemplate: JSON.parse(JSON.stringify(defaultAgreementCustomData)) };
}

async function loadGlobalSettingsFromFirestore() {
    try { const snap = await getDoc(doc(fsDb, `artifacts/${appId}/public/settings`, "global"));
        if (snap.exists()) { globalSettings = { ...getDefaultGlobalSettings(), ...snap.data() }; } 
        else { globalSettings = getDefaultGlobalSettings(); await saveGlobalSettingsToFirestore(); }
    } catch (e) { console.error("Settings Load Error:", e); logErrorToFirestore("loadGlobalSettings", e.message, e); globalSettings = getDefaultGlobalSettings(); }
    agreementCustomData = globalSettings.agreementTemplate ? JSON.parse(JSON.stringify(globalSettings.agreementTemplate)) : JSON.parse(JSON.stringify(defaultAgreementCustomData));
    updatePortalTitle();
}

async function saveGlobalSettingsToFirestore() {
    if (!fsDb || !userProfile.isAdmin) return false;
    globalSettings.agreementTemplate = JSON.parse(JSON.stringify(agreementCustomData));
    try { await setDoc(doc(fsDb, `artifacts/${appId}/public/settings`, "global"), globalSettings, { merge: true }); console.log("Global settings saved."); return true; }
    catch (e) { console.error("Settings Save Error:", e); logErrorToFirestore("saveGlobalSettings", e.message, e); return false; }
}

async function loadAdminServicesFromFirestore() {
    adminManagedServices = [];
    try { const querySnapshot = await getDocs(collection(fsDb, `artifacts/${appId}/public/services`));
        querySnapshot.forEach(d => adminManagedServices.push({ id: d.id, ...d.data() }));
        console.log("Admin services loaded:", adminManagedServices.length);
    } catch (e) { console.error("Services Load Error:", e); logErrorToFirestore("loadAdminServices", e.message, e); }
    renderAdminServicesTable(); populateServiceTypeDropdowns();
}

async function loadAllUsersForAdmin() {
    allUsersCache = {};
    if (!userProfile.isAdmin || !fsDb) return;
    try {
        const usersCollectionRef = collection(fsDb, `artifacts/${appId}/users`);
        const usersSnapshot = await getDocs(usersCollectionRef);
        const profilePromises = [];
        usersSnapshot.forEach(userDoc => {
            const uid = userDoc.id;
            const profileRef = doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details");
            profilePromises.push(getDoc(profileRef));
        });
        const profileSnapshots = await Promise.all(profilePromises);
        profileSnapshots.forEach(profileSnap => {
            if (profileSnap.exists()) {
                const profile = profileSnap.data();
                if (profile.email) allUsersCache[profile.email] = profile;
                else allUsersCache[profile.uid] = profile; // Fallback to UID if no email
            }
        });
        console.log("All users cached:", Object.keys(allUsersCache).length);
    } catch (error) {
        console.error("Error loading all users:", error);
        logErrorToFirestore("loadAllUsersForAdmin", error.message, error);
    }
}

async function loadAllDataForUser() { showLoading("Loading your data..."); /* Add user data loads here */ hideLoading(); }
async function loadAllDataForAdmin() { showLoading("Loading admin data..."); await loadAllUsersForAdmin(); await loadAdminServicesFromFirestore(); await loadPendingApprovalWorkers(); await loadApprovedWorkersForAuthManagement(); renderAdminAgreementCustomizationTab(); hideLoading(); }

/* ========== Portal Entry & Navigation ========== */
function enterPortal(isAdmin) {
    console.log(`Entering portal. Admin: ${isAdmin}`);
    portalAppElement.style.display = "flex"; authScreenElement.style.display = "none";
    updateNavigation(isAdmin); updateProfileDisplay();
    if (isAdmin) { navigateToSection("admin"); renderAdminDashboard(); }
    else { navigateToSection("home"); renderUserHomePage(); if (!userProfile.nextInvoiceNumber) openModal('setInitialInvoiceModal'); }
    updatePortalTitle();
}

function updateNavigation(isAdmin) {
    const linksToShow = ["#home", "#profile", "#invoice", "#agreement"];
    if (isAdmin) { linksToShow.push("#admin"); adminTabElement.classList.remove('hide'); }
    else { adminTabElement.classList.add('hide'); }
    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => a.classList.toggle('hide', !linksToShow.includes(a.hash)));
}

function navigateToSection(sectionId) {
    $$("main section.card").forEach(s => s.classList.remove("active"));
    const target = $(`#${sectionId}`); if (target) target.classList.add("active");
    $$("nav a").forEach(a => a.classList.remove("active"));
    $$(`nav a[href="#${sectionId}"]`).forEach(a => a.classList.add("active"));
    if($("main")) $("main").scrollTop = 0;
    // Call render functions when navigating
    if (sectionId === "profile") renderProfileSection();
    if (sectionId === "invoice") renderInvoiceSection();
    if (sectionId === "agreement") renderAgreementSection();
    if (sectionId === "admin") renderAdminDashboard();
    console.log(`Navigated to #${sectionId}`);
}

/* ========== Auth Functions ========== */
async function modalLogin() {
    const e = authEmailInputElement.value.trim(), p = authPasswordInputElement.value;
    if (!validateEmail(e) || !p) { showAuthStatusMessage("Invalid email or password."); return; }
    showLoading("Logging in..."); showAuthStatusMessage("", false);
    try { await signInWithEmailAndPassword(fbAuth, e, p); }
    catch (err) { console.error("Login Error:", err); logErrorToFirestore("modalLogin", err.message, err); showAuthStatusMessage(err.message); }
    finally { hideLoading(); }
}
async function modalRegister() {
    const e = authEmailInputElement.value.trim(), p = authPasswordInputElement.value;
    if (!validateEmail(e) || p.length < 6) { showAuthStatusMessage("Invalid email or password (min 6 chars)."); return; }
    showLoading("Registering..."); showAuthStatusMessage("", false);
    try { await createUserWithEmailAndPassword(fbAuth, e, p); }
    catch (err) { console.error("Register Error:", err); logErrorToFirestore("modalRegister", err.message, err); showAuthStatusMessage(err.message); }
    finally { hideLoading(); }
}
async function portalSignOut() { showLoading("Logging out..."); try { await fbSignOut(fbAuth); } catch (e) { console.error("Sign Out Error:", e); } finally { hideLoading(); } }

/* ========== Profile Functions ========== */
function renderProfileSection() { if (!userProfile || !currentUserId) return; updateProfileDisplay(); }
function updateProfileDisplay() {
    profileNameElement.textContent = userProfile.name || 'N/A'; profileAbnElement.textContent = userProfile.abn || 'N/A';
    profileGstElement.textContent = userProfile.gstRegistered ? 'Yes' : 'No'; profileBsbElement.textContent = userProfile.bsb || 'N/A';
    profileAccElement.textContent = userProfile.acc || 'N/A'; renderProfileFilesList();
}
function renderProfileFilesList() { /* ... Implementation ... */ }
async function saveProfileDetails(updates) { /* ... Implementation ... */ }
async function uploadProfileDocuments() { /* ... Implementation ... */ }
window.confirmDeleteProfileDocument = (name, path) => { showMessage("Confirm Delete", `Delete ${name}?`, "warning"); /* Add real confirm logic */ window.executeDeleteProfileDocument(name, path); };
window.executeDeleteProfileDocument = async (name, path) => { /* ... Implementation ... */ };

/* ========== Invoice Functions ========== */
function renderInvoiceSection() { /* ... Implementation ... */ }
function populateInvoiceHeader() { /* ... Implementation ... */ }
function renderInvoiceTable() { /* ... Implementation ... */ }
function addInvoiceRowToTable(item = {}, index = -1) { /* ... Implementation ... */ }
function addInvRowUserAction() { /* ... Implementation ... */ }
function updateInvoiceItemFromRow(row, index) { /* ... Implementation ... */ }
window.deleteInvoiceRow = (btn) => { const row = btn.closest('tr'); const idx = row.rowIndex - 1; currentInvoiceData.items.splice(idx, 1); row.remove(); updateInvoiceTotals(); };
function updateInvoiceTotals() { /* ... Implementation ... */ }
async function saveInvoiceDraft() { /* ... Implementation ... */ }
async function loadUserInvoiceDraft() { /* ... Implementation ... */ }
async function saveInitialInvoiceNumber() { const n = parseInt(initialInvoiceNumberInputElement.value, 10); if (isNaN(n) || n <= 0) { showMessage("Invalid Number", "Enter a positive number.", "warning"); return; } userProfile.nextInvoiceNumber = n; await saveProfileDetails({ nextInvoiceNumber: n }); closeModal('setInitialInvoiceModal'); invoiceNumberInputElement.value = n; }
function generateInvoicePdf() { /* ... Implementation ... */ }

/* ========== Agreement Functions ========== */
function renderAgreementSection() { /* ... Implementation ... */ }
function populateAdminWorkerSelectorForAgreement() { /* ... Implementation ... */ }
async function loadAndRenderServiceAgreement(email = null) { /* ... Implementation ... */ }
function renderAgreementClauses(worker, settings, state) { /* ... Implementation ... */ }
function updateAgreementChip(state) { /* ... Implementation ... */ }
function openSignatureModal(who) { signingAs = who; openModal('sigModal'); initializeSignaturePad(); }
function initializeSignaturePad() { /* ... Implementation ... */ }
function clearSignaturePad() { /* ... Implementation ... */ }
function sigStart(e) { /* ... Implementation ... */ }
function sigDraw(e) { /* ... Implementation ... */ }
function sigEnd(e) { /* ... Implementation ... */ }
function getSigPenPosition(e) { /* ... Implementation ... */ }
async function saveSignature() { /* ... Implementation ... */ }
function generateAgreementPdf() { /* ... Implementation ... */ }

/* ========== Admin Functions ========== */
function renderAdminDashboard() { switchAdminTab('adminGlobalSettings'); }
function switchAdminTab(targetId) { adminNavTabButtons.forEach(b => b.classList.toggle('active', b.dataset.target === targetId)); adminContentPanels.forEach(p => p.classList.toggle('active', p.id === targetId)); if (targetId === 'adminServiceManagement') renderAdminServiceManagementTab(); if (targetId === 'adminWorkerManagement') renderAdminWorkerManagementTab(); }
function renderAdminGlobalSettingsTab() { /* ... Implementation ... */ }
async function saveAdminPortalSettings() { /* ... Implementation ... */ }
window.confirmResetGlobalSettings = () => { showMessage("Confirm Reset", "Reset all settings?", "warning"); /* Add real confirm */ window.executeResetGlobalSettings(); };
window.executeResetGlobalSettings = async () => { /* ... Implementation ... */ };
function renderAdminServiceManagementTab() { clearAdminServiceForm(); renderAdminServicesTable(); populateServiceCategoryTypeDropdown(); }
function populateServiceCategoryTypeDropdown() { /* ... Implementation ... */ }
function renderAdminServiceRateFields() { /* ... Implementation ... */ }
function clearAdminServiceForm() { /* ... Implementation ... */ }
function renderAdminServicesTable() { /* ... Implementation ... */ }
window.editAdminService = (id) => { /* ... Implementation ... */ };
window.deleteAdminService = (id) => { showMessage("Confirm Delete", `Delete service ${id}?`, "warning"); /* Add real confirm */ window._confirmDeleteServiceFirestore(id); };
window._confirmDeleteServiceFirestore = async (id) => { /* ... Implementation ... */ };
async function saveAdminServiceToFirestore() { /* ... Implementation ... */ }
function openTravelCodeSelectionModal() { /* ... Implementation ... */ }
function renderAdminAgreementCustomizationTab() { /* ... Implementation ... */ }
function renderAdminAgreementClausesEditor() { /* ... Implementation ... */ }
function addAdminAgreementClauseEditor() { /* ... Implementation ... */ }
function updateAdminAgreementPreview() { /* ... Implementation ... */ }
async function saveAdminAgreementCustomizationsToFirestore() { /* ... Implementation ... */ }
function renderAdminWorkerManagementTab() { loadPendingApprovalWorkers(); loadApprovedWorkersForAuthManagement(); }
async function loadPendingApprovalWorkers() { /* ... Implementation ... */ }
window.approveWorkerInFirestore = async (uid) => { /* ... Implementation ... */ };
window.denyWorkerInFirestore = async (uid) => { /* ... Implementation ... */ };
async function loadApprovedWorkersForAuthManagement() { /* ... Implementation ... */ }
window.selectWorkerForAuth = (uid, name) => { /* ... Implementation ... */ };
async function saveWorkerAuthorizationsToFirestore() { /* ... Implementation ... */ }

/* ========== Modal & Wizard Functions ========== */
function openUserSetupWizard() { currentUserWizardStep = 1; navigateWizard('user', 1); openModal('wiz'); }
function openAdminSetupWizard() { currentAdminWizardStep = 1; navigateWizard('admin', 1); openModal('adminSetupWizard'); }
function navigateWizard(type, step) { /* ... Implementation ... */ }
function wizardNext(type) { /* ... Implementation ... */ }
function wizardPrev(type) { /* ... Implementation ... */ }
async function finishUserWizard() { /* ... Implementation ... */ }
async function finishAdminWizard() { /* ... Implementation ... */ }
function openCustomTimePicker(inputElement, callback) { /* ... Implementation ... */ }

/* ========== Event Listeners Setup ========== */
function setupEventListeners() {
    // Auth
    loginButtonElement?.addEventListener('click', modalLogin);
    registerButtonElement?.addEventListener('click', modalRegister);
    logoutButtonElement?.addEventListener('click', portalSignOut);
    authPasswordInputElement?.addEventListener('keypress', e => { if (e.key === 'Enter') modalLogin(); });

    // Navigation
    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => a.addEventListener('click', e => { e.preventDefault(); navigateToSection(a.hash.substring(1)); }));

    // Profile
    editProfileButtonElement?.addEventListener('click', () => openModal('wiz')); // Re-use wizard for editing
    uploadProfileDocumentsButtonElement?.addEventListener('click', uploadProfileDocuments);

    // Invoice
    addInvoiceRowButtonElement?.addEventListener('click', addInvRowUserAction);
    saveDraftButtonElement?.addEventListener('click', saveInvoiceDraft);
    generateInvoicePdfButtonElement?.addEventListener('click', generateInvoicePdf);
    saveInitialInvoiceNumberButtonElement?.addEventListener('click', saveInitialInvoiceNumber);
    invoiceDateInputElement?.addEventListener('change', () => { if(invoiceWeekLabelElement) invoiceWeekLabelElement.textContent = getWeekNumber(new Date(invoiceDateInputElement.value)); });


    // Agreement
    signAgreementButtonElement?.addEventListener('click', () => openSignatureModal('worker'));
    participantSignButtonElement?.addEventListener('click', () => openSignatureModal('participant'));
    downloadAgreementPdfButtonElement?.addEventListener('click', generateAgreementPdf);
    saveSignatureButtonElement?.addEventListener('click', saveSignature);
    closeSignatureModalButtonElement?.addEventListener('click', () => closeModal('sigModal'));
    loadServiceAgreementForSelectedWorkerButtonElement?.addEventListener('click', () => {
        currentAgreementWorkerEmail = adminSelectWorkerForAgreementElement.value;
        loadAndRenderServiceAgreement(currentAgreementWorkerEmail);
    });

    // Admin Tabs
    adminNavTabButtons.forEach(btn => btn.addEventListener('click', () => switchAdminTab(btn.dataset.target)));

    // Admin Global Settings
    saveAdminPortalSettingsButtonElement?.addEventListener('click', saveAdminPortalSettings);
    resetGlobalSettingsToDefaultsButtonElement?.addEventListener('click', window.confirmResetGlobalSettings); // Use window func
    copyInviteLinkButtonElement?.addEventListener('click', () => { navigator.clipboard.writeText(inviteLinkCodeElement.textContent); showMessage("Copied!", "Invite link copied to clipboard.", "success"); });

    // Admin Service Management
    saveAdminServiceButtonElement?.addEventListener('click', saveAdminServiceToFirestore);
    clearAdminServiceFormButtonElement?.addEventListener('click', clearAdminServiceForm);
    selectTravelCodeButtonElement?.addEventListener('click', openTravelCodeSelectionModal);
    adminServiceCategoryTypeSelectElement?.addEventListener('change', renderAdminServiceRateFields); // Corrected

    // Admin Agreement Customization
    adminAddAgreementClauseButtonElement?.addEventListener('click', addAdminAgreementClauseEditor);
    saveAdminAgreementCustomizationsButtonElement?.addEventListener('click', saveAdminAgreementCustomizationsToFirestore);

    // Admin Worker Management
    saveWorkerAuthorizationsButtonElement?.addEventListener('click', saveWorkerAuthorizationsToFirestore);

    // Modals & Wizards
    closeRequestModalButtonElement?.addEventListener('click', () => closeModal('rqModal'));
    saveRequestButtonElement?.addEventListener('click', () => { /* Add save shift request logic */ closeModal('rqModal'); });
    closeLogShiftModalButtonElement?.addEventListener('click', () => closeModal('logShiftModal'));
    saveShiftToInvoiceButtonElement?.addEventListener('click', () => { /* Add save shift to invoice logic */ closeModal('logShiftModal'); });
    closeMessageModalButtonElement?.addEventListener('click', () => closeModal('messageModal'));
    wizardNextButton1Element?.addEventListener('click', () => wizardNext('user'));
    wizardNextButton2Element?.addEventListener('click', () => wizardNext('user'));
    wizardNextButton3Element?.addEventListener('click', () => wizardNext('user'));
    wizardPrevButton2Element?.addEventListener('click', () => wizardPrev('user'));
    wizardPrevButton3Element?.addEventListener('click', () => wizardPrev('user'));
    wizardPrevButton4Element?.addEventListener('click', () => wizardPrev('user'));
    wizardFinishButtonElement?.addEventListener('click', finishUserWizard);
    adminWizardNextButton1Element?.addEventListener('click', () => wizardNext('admin'));
    adminWizardNextButton2Element?.addEventListener('click', () => wizardNext('admin'));
    adminWizardPrevButton2Element?.addEventListener('click', () => wizardPrev('admin'));
    adminWizardPrevButton3Element?.addEventListener('click', () => wizardPrev('admin'));
    adminWizardFinishButtonElement?.addEventListener('click', finishAdminWizard);

    // Time Picker
    cancelTimeButtonElement?.addEventListener('click', () => closeModal('customTimePicker'));
    setTimeButtonElement?.addEventListener('click', () => { /* Add set time logic */ });
    timePickerBackButtonElement?.addEventListener('click', () => { /* Add time picker back logic */ });

    // Other global listeners or initializations
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash || '#home';
        navigateToSection(hash.substring(1));
    });
}

/* ========== App Initialization ========== */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed");
    showLoading("Initializing Portal...");
    await initializeFirebaseApp();
    setupEventListeners();

    // Check hash on load and navigate
    const initialHash = window.location.hash || '#home';
    navigateToSection(initialHash.substring(1));

    // Wait for auth to be ready before hiding the final load
    // `initializeFirebaseApp` calls `setupAuthListener` which resolves
    // when the first auth check is done.
    hideLoading(); // Hide after init and initial nav setup
});

// NOTE: Many function bodies (like `renderProfileFilesList`, `saveProfileDetails`, etc.) 
// are marked as `/* ... Implementation ... */`. These need to be filled out with 
// the actual application logic based on the full requirements. 
// This structure provides the framework and connects the UI elements.
