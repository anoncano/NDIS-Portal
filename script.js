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
const signatureModalElement = $("#sigModal"), signatureCanvasElement = $("#signatureCanvas"), saveSignatureButtonElement = $("#saveSigBtn"), clearSignatureButtonElement = $("#clearSigBtn"), closeSignatureModalButtonElement = $("#closeSigModalBtn");
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
let userProfile = {
    name: '', abn: '', gstRegistered: false, bsb: '', acc: '',
    files: [], // { name: 'doc.pdf', url: '...', path: '...' }
    nextInvoiceNumber: 1001,
    profileSetupComplete: false,
    isAdmin: false,
    approved: false, // For organization portal type
    authorizedServices: [], // Array of service IDs worker is authorized for
    email: '',
    uid: ''
};
let globalSettings = {}; // Loaded from Firestore or defaults
let adminManagedServices = []; // Array of service objects {id, code, description, categoryType, rates: {}, travelCodeId}
let userAuthorizedServices = []; // Subset of adminManagedServices, filtered by userProfile.authorizedServices
let currentInvoiceData = {
    id: null, // Firestore ID of the draft invoice
    items: [], // {id, date, serviceId, description, startTime, endTime, hours, rate, total, isTravel, travelKm, travelServiceId}
    invoiceNumber: "",
    invoiceDate: "",
    subtotal: 0,
    gst: 0,
    grandTotal: 0,
    status: "draft" // "draft", "issued", "paid"
};
let agreementCustomData = {}; // Loaded from globalSettings.agreementTemplate
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
const RATE_CATEGORIES = ["weekday", "evening", "night", "saturday", "sunday", "public", "flat"]; // Added "flat" for single rate services
const SERVICE_CATEGORY_TYPES = {
    CORE_STANDARD: 'core_standard', CORE_HIGH_INTENSITY: 'core_high_intensity',
    CAPACITY_THERAPY_STD: 'capacity_therapy_std', CAPACITY_SPECIALIST: 'capacity_specialist',
    TRAVEL_KM: 'travel_km', OTHER_FLAT_RATE: 'other_flat_rate'
};
let sigCanvas, sigCtx, sigPen = false, sigPaths = [], currentSignatureFor = null; // currentSignatureFor: 'worker' or 'participant'
let currentAgreementWorkerEmail = null; // For admin viewing/managing other workers' agreements
let currentAgreementData = null; // Holds the specific agreement being viewed/signed {id, workerId, participantSignature, workerSignature, status, contentSnapshot, signedDates: {worker, participant}}
let signingAs = 'worker';
let isFirebaseInitialized = false, initialAuthComplete = false;
let selectedWorkerEmailForAuth = null; // For admin authorizing services for a worker
let currentAdminServiceEditingId = null; // ID of the service being edited in admin panel
let currentTimePickerStep, selectedMinute, selectedHour12, selectedAmPm, activeTimeInput, timePickerCallback;
let currentAdminWizardStep = 1, currentUserWizardStep = 1;
let wizardFileUploads = []; // Array to hold File objects for wizard before final upload
let allUsersCache = {}; // Cache for admin user lookups: { uid: {profileData}, ... }

/* ========== Error Logging ========== */
async function logErrorToFirestore(location, errorMsg, errorDetails = {}) {
    if (!fsDb || !appId || appId === 'ndis-portal-app-local') { console.error("Firestore not init/local dev, no log:", location, errorMsg, errorDetails); return; }
    try {
        await fsAddDoc(collection(fsDb, `artifacts/${appId}/public/logs/errors`), {
            location: String(location), errorMessage: String(errorMsg),
            errorStack: errorDetails instanceof Error ? errorDetails.stack : JSON.stringify(errorDetails),
            user: currentUserEmail || currentUserId || "unknown", timestamp: serverTimestamp(),
            appVersion: "1.1.0", userAgent: navigator.userAgent, url: window.location.href
        });
        console.info("Error logged:", location);
    } catch (logError) { console.error("FATAL: Could not log error:", logError, "Original:", location, errorMsg); }
}

/* ========== UI Helpers ========== */
function showLoading(message = "Loading...") { if (loadingOverlayElement) { loadingOverlayElement.querySelector('p').textContent = message; loadingOverlayElement.style.display = "flex"; } }
function hideLoading() { if (loadingOverlayElement) loadingOverlayElement.style.display = "none"; }
function showAuthStatusMessage(message, isError = true) { if (authStatusMessageElement) { authStatusMessageElement.textContent = message; authStatusMessageElement.style.color = isError ? 'var(--danger)' : 'var(--ok)'; authStatusMessageElement.style.display = message ? 'block' : 'none'; } }
function showMessage(title, text, type = 'info', duration = 3000) {
    const iconClass = type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
    if (messageModalTitleElement) messageModalTitleElement.innerHTML = `<i class="fas ${iconClass}"></i> ${title}`;
    if (messageModalTextElement) messageModalTextElement.innerHTML = text;
    if (messageModalElement) {
        messageModalElement.className = `modal ${type}`; // Add type class for styling
        messageModalElement.style.display = "flex";
        if (duration > 0 && closeMessageModalButtonElement) { // Ensure button exists before setting timeout
           const timer = setTimeout(() => closeModal('messageModal'), duration);
           // Clear timeout if modal is closed manually
           closeMessageModalButtonElement.onclick = () => { clearTimeout(timer); closeModal('messageModal'); };
        } else if (closeMessageModalButtonElement) {
            closeMessageModalButtonElement.onclick = () => closeModal('messageModal');
        }
    }
}
function openModal(modalId) { const modal = $(`#${modalId}`); if (modal) modal.style.display = 'flex'; }
function closeModal(modalId) { const modal = $(`#${modalId}`); if (modal) modal.style.display = 'none'; }

/* ========== Utilities ========== */
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase()); }
function formatDateForDisplay(d) { if (!d) return ""; try { const date = d.toDate ? d.toDate() : new Date(d); return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return "Invalid Date"; } }
function formatDateForInput(d) { if (!d) return ""; try { const date = d.toDate ? d.toDate() : new Date(d); const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), day = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; } catch (e) { return ""; } }
function timeToMinutes(t) { if (!t || !t.includes(':')) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function calculateHours(s, e) { if (!s || !e) return 0; const diff = timeToMinutes(e) - timeToMinutes(s); return diff > 0 ? parseFloat((diff / 60).toFixed(2)) : 0; }
function determineRateType(dStr, sTime) {
    if (!dStr || !sTime) return "weekday";
    try {
        const d = new Date(`${dStr}T${sTime}:00`);
        const day = d.getDay(); // Sunday - Saturday : 0 - 6
        const hr = d.getHours();

        // TODO: Implement public holiday check. This would require a list of public holidays.
        // For now, it's manual or based on a "public" rate category if chosen.

        if (day === 0) return "sunday";
        if (day === 6) return "saturday";
        // NDIS standard hours can vary, common is before 8pm for evening
        if (hr >= 20 || hr < 6) return "night"; // Typically 8 PM to 6 AM
        if (hr >= 18 && hr < 20) return "evening"; // Example: 6 PM to 8 PM
        return "weekday";
    } catch (error) {
        console.warn("Error determining rate type for date:", dStr, "time:", sTime, error);
        return "weekday"; // Default fallback
    }
}
function formatTime12Hour(t24) { if (!t24 || !t24.includes(':')) return ""; const [h, m] = t24.split(':'); const hr = parseInt(h, 10); const ap = hr >= 12 ? 'PM' : 'AM'; let hr12 = hr % 12; hr12 = hr12 ? hr12 : 12; return `${String(hr12).padStart(2, '0')}:${m} ${ap}`; }
function formatCurrency(n) { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n || 0); }
function generateUniqueId(prefix = 'id_') { return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 9); }
function getWeekNumber(d) {
    const date = new Date(d.valueOf());
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
function simpleMarkdownToHtml(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>')     // Italics
        .replace(/\{\{(.*?)\}\}/g, '<span class="placeholder">Preview: $1</span>') // Show placeholders clearly
        .replace(/\n/g, '<br>');                 // Newlines
}

/* ========== Firebase Initialization & Auth ========== */
async function initializeFirebaseApp() {
    console.log("[FirebaseInit] Initializing...");
    let firebaseConfig = window.firebaseConfigForApp; // From HTML

    // Override with __firebase_config if provided by Canvas environment
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        try {
            const parsedConfig = JSON.parse(__firebase_config);
            if (parsedConfig && parsedConfig.apiKey && !parsedConfig.apiKey.startsWith("YOUR_")) {
                firebaseConfig = parsedConfig;
                console.log("[FirebaseInit] Using Firebase config from __firebase_config.");
            } else {
                console.warn("[FirebaseInit] __firebase_config is incomplete or uses placeholders. Falling back to config in HTML.");
            }
        } catch (e) {
            console.error("[FirebaseInit] Error parsing __firebase_config:", e, "Using config in HTML.");
        }
    }

    if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_")) {
        showAuthStatusMessage("System Error: Portal configuration is invalid or missing."); hideLoading(); return;
    }
    try {
        fbApp = initializeApp(firebaseConfig, appId); // Use appId as the app name
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
                    if(portalAppElement) portalAppElement.style.display = "flex"; // Changed from flex to block for main layout
                    
                    await loadGlobalSettingsFromFirestore(); // Load global settings first
                    const profileData = await loadUserProfileFromFirestore(currentUserId);
                    let signedOut = false;

                    if (profileData) {
                        signedOut = await handleExistingUserProfile(profileData);
                    } else if (currentUserEmail && currentUserEmail.toLowerCase() === (globalSettings.adminEmail || "admin@portal.com")) { // Check against configured admin email
                        signedOut = await handleNewAdminProfile();
                    } else if (currentUserId) {
                        signedOut = await handleNewRegularUserProfile();
                    } else {
                        // This case should ideally not be reached if user object is present
                        console.warn("[AuthListener] User object present but no identifiable role. Signing out.");
                        await fbSignOut(fbAuth);
                        signedOut = true;
                    }

                    if (signedOut) {
                        console.log("[AuthListener] User flow led to sign out.");
                        // UI reset will be handled by the 'else' block of this onAuthStateChanged
                    }
                } else {
                    console.log("[AuthListener] User signed out or no user.");
                    currentUserId = null; currentUserEmail = null; userProfile = {}; globalSettings = {}; adminManagedServices = []; userAuthorizedServices = [];
                    if(userIdDisplayElement) userIdDisplayElement.textContent = "Not Logged In";
                    if(logoutButtonElement) logoutButtonElement.classList.add('hide');
                    if(authScreenElement) authScreenElement.style.display = "flex";
                    if(portalAppElement) portalAppElement.style.display = "none";
                    updateNavigation(false); navigateToSection("home"); // Default to home on logout
                }
            } catch (error) {
                console.error("[AuthListener] Error:", error);
                logErrorToFirestore("onAuthStateChanged", error.message, error);
                if (fbAuth) await fbSignOut(fbAuth).catch(e => console.error("Error during forced signout:", e));
            }
            finally { hideLoading(); if (!initialAuthComplete) { initialAuthComplete = true; resolve(); } }
        });

        // Attempt to sign in with custom token if available
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            console.log("[AuthListener] Attempting sign-in with __initial_auth_token.");
            signInWithCustomToken(fbAuth, __initial_auth_token)
                .then(() => console.log("[AuthListener] Successfully signed in with custom token."))
                .catch(e => {
                    console.error("[AuthListener] Custom token sign-in error:", e);
                    logErrorToFirestore("signInWithCustomToken", e.message, e);
                    // If token fails, the onAuthStateChanged will eventually report no user.
                });
        } else {
            console.log("[AuthListener] No __initial_auth_token found. Waiting for standard auth state change or login action.");
        }
    });
}

async function handleExistingUserProfile(data) {
    userProfile = { ...userProfile, ...data, uid: currentUserId, email: currentUserEmail }; // Ensure uid and email are current
    console.log(`[Auth] Existing profile. Approved: ${userProfile.approved}, Admin: ${userProfile.isAdmin}, SetupComplete: ${userProfile.profileSetupComplete}`);

    if (!userProfile.isAdmin && globalSettings.portalType === 'organization' && !userProfile.approved) {
        showMessage("Approval Required", "Your account is registered but awaits administrator approval. You will be logged out.", "warning", 0); // 0 duration = manual close
        await fbSignOut(fbAuth); return true; // true indicates sign out occurred
    }

    if (userProfile.isAdmin) {
        await loadAllDataForAdmin();
        enterPortal(true);
        if (!globalSettings.setupComplete) {
            openAdminSetupWizard();
        }
    } else {
        await loadUserAuthorizedServices(); // Load services user is allowed to use
        await loadAllDataForUser();
        enterPortal(false);
        if (!userProfile.profileSetupComplete) {
            openUserSetupWizard();
        } else if (!userProfile.nextInvoiceNumber) {
            openModal('setInitialInvoiceModal');
        }
    }
    return false; // false indicates no sign out occurred here
}

async function handleNewAdminProfile() {
    console.log("[Auth] New admin login detected for:", currentUserEmail);
    userProfile = {
        name: "Administrator", email: currentUserEmail, uid: currentUserId,
        isAdmin: true, approved: true, profileSetupComplete: true, // Admins are auto-approved and setup
        nextInvoiceNumber: 1001, createdAt: serverTimestamp(), files: []
    };
    try {
        await setDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), userProfile);
        console.log("[Auth] New admin profile created in Firestore.");
        // Ensure global settings are at least default if they don't exist, especially adminEmail
        if (!globalSettings.adminEmail) {
             globalSettings.adminEmail = currentUserEmail; // Set this admin as the primary if not set
             await saveGlobalSettingsToFirestore(true); // Save silently
        }
        await loadAllDataForAdmin();
        enterPortal(true);
        if (!globalSettings.setupComplete) {
            openAdminSetupWizard();
        }
    } catch (error) {
        console.error("[Auth] Error creating new admin profile:", error);
        logErrorToFirestore("handleNewAdminProfile.setDoc", error.message, error);
        showMessage("Admin Setup Error", "Could not create admin profile. Please try again or contact support.", "error", 0);
        await fbSignOut(fbAuth); return true;
    }
    return false;
}

async function handleNewRegularUserProfile() {
    console.log("[Auth] New regular user detected:", currentUserEmail);
    const isOrgPortal = globalSettings.portalType === 'organization';
    userProfile = {
        name: currentUserEmail.split('@')[0], // Default name from email
        email: currentUserEmail, uid: currentUserId, isAdmin: false,
        approved: !isOrgPortal, // Auto-approve if not an organization portal
        profileSetupComplete: false,
        nextInvoiceNumber: 1001, // Default starting invoice number
        createdAt: serverTimestamp(),
        files: [], authorizedServices: []
    };
    try {
        await setDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), userProfile);
        console.log("[Auth] New regular user profile created in Firestore.");

        if (isOrgPortal && !userProfile.approved) {
            showMessage("Registration Complete", "Your account has been registered and is awaiting administrator approval. You will be logged out.", "info", 0);
            await fbSignOut(fbAuth); return true;
        }
        await loadUserAuthorizedServices();
        await loadAllDataForUser();
        enterPortal(false);
        if (!userProfile.profileSetupComplete) {
            openUserSetupWizard();
        }
    } catch (error) {
        console.error("[Auth] Error creating new regular user profile:", error);
        logErrorToFirestore("handleNewRegularUserProfile.setDoc", error.message, error);
        showMessage("Registration Error", "Could not create your profile. Please try again or contact support.", "error", 0);
        await fbSignOut(fbAuth); return true;
    }
    return false;
}


/* ========== Data Loading & Saving ========== */
async function loadUserProfileFromFirestore(uid) {
    if (!fsDb || !uid) { console.warn("Firestore or UID not available for profile load."); return null; }
    try {
        const profileDocRef = doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details");
        const snap = await getDoc(profileDocRef);
        if (snap.exists()) {
            console.log("[DataLoad] User profile loaded from Firestore for UID:", uid);
            return snap.data();
        } else {
            console.log("[DataLoad] No profile document found for UID:", uid);
            return null;
        }
    }
    catch (e) { console.error("Profile Load Error:", e); logErrorToFirestore("loadUserProfileFromFirestore", e.message, e); return null; }
}

function getDefaultGlobalSettings() {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    return {
        portalTitle: "NDIS Support Portal",
        organizationName: "My NDIS Org",
        organizationAbn: "Not Set",
        organizationContactEmail: "contact@example.com",
        organizationContactPhone: "000-000-000",
        defaultParticipantName: "Valued Participant",
        defaultParticipantNdisNo: "000000000",
        defaultPlanManagerName: "Plan Manager Co.",
        defaultPlanManagerEmail: "pm@example.com",
        defaultPlanManagerPhone: "111-111-111",
        defaultPlanEndDate: formatDateForInput(nextYear),
        setupComplete: false, // Indicates if admin setup wizard has been completed
        portalType: "organization", // "organization" or "participant" (for self-managed)
        adminEmail: "admin@portal.com", // Default admin email, can be changed
        agreementTemplate: JSON.parse(JSON.stringify(defaultAgreementCustomData)) // Deep copy
    };
}

async function loadGlobalSettingsFromFirestore() {
    if (!fsDb) { console.warn("Firestore not available for global settings load."); globalSettings = getDefaultGlobalSettings(); return; }
    try {
        const settingsDocRef = doc(fsDb, `artifacts/${appId}/public/settings`, "global");
        const snap = await getDoc(settingsDocRef);
        if (snap.exists()) {
            globalSettings = { ...getDefaultGlobalSettings(), ...snap.data() }; // Merge with defaults to ensure all keys exist
            console.log("[DataLoad] Global settings loaded from Firestore.");
        }
        else {
            console.log("[DataLoad] No global settings found in Firestore. Using defaults and attempting to save.");
            globalSettings = getDefaultGlobalSettings();
            await saveGlobalSettingsToFirestore(true); // Save defaults silently
        }
    } catch (e) {
        console.error("Global Settings Load Error:", e);
        logErrorToFirestore("loadGlobalSettingsFromFirestore", e.message, e);
        globalSettings = getDefaultGlobalSettings(); // Fallback to defaults on error
    }
    // Ensure agreementCustomData is populated
    agreementCustomData = globalSettings.agreementTemplate ? JSON.parse(JSON.stringify(globalSettings.agreementTemplate)) : JSON.parse(JSON.stringify(defaultAgreementCustomData));
    updatePortalTitle();
}

async function saveGlobalSettingsToFirestore(isSilent = false) {
    if (!fsDb) { console.warn("Firestore not available for saving global settings."); return false; }
    // Only admins should typically save global settings, but initial setup might bypass this.
    // if (!userProfile.isAdmin && !isSilent) { console.warn("Attempt to save global settings by non-admin."); return false; }

    globalSettings.agreementTemplate = JSON.parse(JSON.stringify(agreementCustomData)); // Ensure latest agreement template is saved
    try {
        const settingsDocRef = doc(fsDb, `artifacts/${appId}/public/settings`, "global");
        await setDoc(settingsDocRef, globalSettings, { merge: true }); // Use merge to avoid overwriting fields unintentionally
        if (!isSilent) {
            showMessage("Settings Saved", "Global portal settings have been updated.", "success");
        }
        console.log("[DataSave] Global settings saved to Firestore.");
        updatePortalTitle(); // Update UI if title changed
        return true;
    }
    catch (e) {
        console.error("Global Settings Save Error:", e);
        logErrorToFirestore("saveGlobalSettingsToFirestore", e.message, e);
        if (!isSilent) {
            showMessage("Save Error", "Could not save global settings: " + e.message, "error");
        }
        return false;
    }
}

async function loadAdminServicesFromFirestore() {
    if (!fsDb) { console.warn("Firestore not available for admin services load."); adminManagedServices = []; return; }
    adminManagedServices = [];
    try {
        const servicesCollectionRef = collection(fsDb, `artifacts/${appId}/public/services`);
        const querySnapshot = await getDocs(servicesCollectionRef);
        querySnapshot.forEach(doc => {
            adminManagedServices.push({ id: doc.id, ...doc.data() });
        });
        adminManagedServices.sort((a, b) => (a.code || "").localeCompare(b.code || "")); // Sort by code
        console.log("[DataLoad] Admin managed services loaded:", adminManagedServices.length);
    } catch (e) {
        console.error("Admin Services Load Error:", e);
        logErrorToFirestore("loadAdminServicesFromFirestore", e.message, e);
    }
    // These functions should be called after data is loaded, typically in the section rendering function
    // renderAdminServicesTable();
    // populateServiceTypeDropdowns(); // For invoice and log shift modals
}

async function loadUserAuthorizedServices() {
    if (!userProfile || userProfile.isAdmin || !userProfile.authorizedServices || userProfile.authorizedServices.length === 0) {
        userAuthorizedServices = userProfile.isAdmin ? [...adminManagedServices] : []; // Admins can use all services
        console.log("[DataLoad] User authorized services set (admin or none). Count:", userAuthorizedServices.length);
        return;
    }
    // Ensure adminManagedServices are loaded before trying to filter
    if (adminManagedServices.length === 0) {
        await loadAdminServicesFromFirestore();
    }
    userAuthorizedServices = adminManagedServices.filter(service => userProfile.authorizedServices.includes(service.id));
    console.log("[DataLoad] User authorized services filtered. Count:", userAuthorizedServices.length);
}


async function loadAllUsersForAdmin() {
    allUsersCache = {};
    if (!userProfile.isAdmin || !fsDb) return;
    console.log("[DataLoad] Loading all user profiles for admin...");
    try {
        const usersCollectionRef = collection(fsDb, `artifacts/${appId}/users`);
        const usersSnapshot = await getDocs(usersCollectionRef);
        const profilePromises = [];

        usersSnapshot.forEach(userDoc => {
            const uid = userDoc.id;
            // Avoid loading the admin's own detailed profile again if it's already in userProfile
            // or to prevent potential loops if admin structure is complex.
            // However, for a simple list, it's fine.
            const profileRef = doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details");
            profilePromises.push(getDoc(profileRef).then(snap => ({ uid, snap })));
        });

        const results = await Promise.all(profilePromises);
        results.forEach(({ uid, snap }) => {
            if (snap.exists()) {
                const profile = snap.data();
                allUsersCache[uid] = { ...profile, uid: uid }; // Ensure UID is part of the cached object
            } else {
                console.warn(`[DataLoad] No profile document found for user ID: ${uid} during admin load.`);
            }
        });
        console.log("[DataLoad] All user profiles cached for admin. Count:", Object.keys(allUsersCache).length);
    } catch (error) {
        console.error("Error loading all users for admin:", error);
        logErrorToFirestore("loadAllUsersForAdmin", error.message, error);
    }
}


async function loadAllDataForUser() {
    showLoading("Loading your data...");
    await loadUserInvoiceDraft(); // Load existing invoice draft if any
    await loadUserShiftRequests(); // Load user's shift requests
    // Potentially load other user-specific data like past invoices, agreements etc.
    hideLoading();
}
async function loadAllDataForAdmin() {
    showLoading("Loading admin data...");
    // Services are loaded by loadGlobalSettings or loadUserAuthorizedServices if needed earlier
    // await loadAdminServicesFromFirestore(); // Already called if needed or will be by specific tabs
    await loadAllUsersForAdmin();
    // Specific admin tab data is loaded when the tab is rendered
    // await loadPendingApprovalWorkers();
    // await loadApprovedWorkersForAuthManagement();
    // renderAdminAgreementCustomizationTab(); // This populates the form from globalSettings.agreementTemplate
    hideLoading();
}

/* ========== Portal Entry & Navigation ========== */
function enterPortal(isAdmin) {
    console.log(`Entering portal. Admin: ${isAdmin}`);
    if (portalAppElement) portalAppElement.style.display = "flex"; // Ensure it's flex for side nav layout
    if (authScreenElement) authScreenElement.style.display = "none";
    
    updateNavigation(isAdmin);
    updateProfileDisplay(); // Update general profile display elements if any outside profile tab

    if (isAdmin) {
        navigateToSection("admin"); // Default to admin dashboard
        renderAdminDashboard(); // Initial render of the active admin tab
    } else {
        navigateToSection("home");
        renderUserHomePage();
        if (userProfile && !userProfile.nextInvoiceNumber && initialInvoiceNumberInputElement) { // Check userProfile directly
            openModal('setInitialInvoiceModal');
            initialInvoiceNumberInputElement.value = "1001"; // Default placeholder
        }
    }
    updatePortalTitle();
}

function updateNavigation(isAdmin) {
    const linksToShow = ["#home", "#profile", "#invoice", "#agreement"];
    if (isAdmin && adminTabElement) {
        linksToShow.push("#admin");
        adminTabElement.classList.remove('hide');
    } else if (adminTabElement) {
        adminTabElement.classList.add('hide');
    }

    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => {
        const sectionId = a.hash.substring(1);
        a.classList.toggle('hide', !linksToShow.includes(a.hash));
        // Special handling for admin tab on bottom nav if it exists
        if (a.closest('nav#bottom') && sectionId === 'admin') {
             a.classList.toggle('hide', !isAdmin);
        }
    });
}

function navigateToSection(sectionId) {
    if (!sectionId) sectionId = "home"; // Default to home if no sectionId
    $$("main section.card").forEach(s => s.classList.remove("active"));
    const targetSection = $(`#${sectionId}`);
    if (targetSection) {
        targetSection.classList.add("active");
    } else {
        console.warn(`NavigateToSection: Section with ID "${sectionId}" not found. Defaulting to home.`);
        $(`#home`)?.classList.add("active");
        sectionId = "home"; // Correct sectionId if fallback occurs
    }

    $$("nav a").forEach(a => a.classList.remove("active"));
    $$(`nav a[href="#${sectionId}"]`).forEach(a => a.classList.add("active"));

    const mainElement = $("main");
    if(mainElement) mainElement.scrollTop = 0; // Scroll to top of new section

    // Call render functions when navigating
    switch (sectionId) {
        case "home": renderUserHomePage(); break;
        case "profile": renderProfileSection(); break;
        case "invoice": renderInvoiceSection(); break;
        case "agreement": renderAgreementSection(); break;
        case "admin": if (userProfile.isAdmin) renderAdminDashboard(); break;
        default: console.warn("Navigation to unknown section:", sectionId);
    }
    console.log(`Navigated to #${sectionId}`);
    window.location.hash = sectionId; // Ensure URL hash is updated
}

/* ========== Auth Functions ========== */
async function modalLogin() {
    if (!authEmailInputElement || !authPasswordInputElement) return;
    const e = authEmailInputElement.value.trim(), p = authPasswordInputElement.value;
    if (!validateEmail(e) || !p) { showAuthStatusMessage("Invalid email or password format."); return; }
    showLoading("Logging in..."); showAuthStatusMessage("", false);
    try { await signInWithEmailAndPassword(fbAuth, e, p); }
    catch (err) { console.error("Login Error:", err); logErrorToFirestore("modalLogin", err.message, err); showAuthStatusMessage(err.message); }
    finally { hideLoading(); }
}
async function modalRegister() {
    if (!authEmailInputElement || !authPasswordInputElement) return;
    const e = authEmailInputElement.value.trim(), p = authPasswordInputElement.value;
    if (!validateEmail(e) || p.length < 6) { showAuthStatusMessage("Invalid email or password (min 6 chars for password)."); return; }
    showLoading("Registering..."); showAuthStatusMessage("", false);
    try { await createUserWithEmailAndPassword(fbAuth, e, p); } // onAuthStateChanged will handle profile creation
    catch (err) { console.error("Register Error:", err); logErrorToFirestore("modalRegister", err.message, err); showAuthStatusMessage(err.message); }
    finally { hideLoading(); }
}
async function portalSignOut() {
    showLoading("Logging out...");
    try {
        if (fbAuth) await fbSignOut(fbAuth);
        // onAuthStateChanged will handle UI reset
    } catch (e) {
        console.error("Sign Out Error:", e);
        logErrorToFirestore("portalSignOut", e.message, e);
        showMessage("Logout Error", "An error occurred while signing out.", "error");
    } finally {
        hideLoading();
    }
}

/* ========== Profile Functions ========== */
function renderProfileSection() {
    if (!userProfile || !currentUserId || !profileNameElement) return;
    updateProfileDisplay();
    renderProfileFilesList();
}

function updateProfileDisplay() {
    if (!userProfile) return;
    if (profileNameElement) profileNameElement.textContent = userProfile.name || 'N/A';
    if (profileAbnElement) profileAbnElement.textContent = userProfile.abn || 'N/A';
    if (profileGstElement) profileGstElement.textContent = userProfile.gstRegistered ? 'Yes' : 'No';
    if (profileBsbElement) profileBsbElement.textContent = userProfile.bsb || 'N/A';
    if (profileAccElement) profileAccElement.textContent = userProfile.acc || 'N/A';

    // Also update home page name display if it exists
    if (userNameDisplayElement) userNameDisplayElement.textContent = userProfile.name || "User";
}

function renderProfileFilesList() {
    if (!profileFilesListElement) return;
    profileFilesListElement.innerHTML = ''; // Clear existing list
    if (userProfile.files && userProfile.files.length > 0) {
        userProfile.files.forEach(file => {
            const li = document.createElement('li');
            li.innerHTML = `
                <i class="fas fa-file-alt"></i> ${file.name}
                <span>
                    <a href="${file.url}" target="_blank" class="btn-secondary btn-small" title="Download/View File"><i class="fas fa-download"></i> View</a>
                    <button class="btn-danger btn-small delete-file-btn" data-path="${file.path}" data-name="${file.name}" title="Delete File"><i class="fas fa-trash-alt"></i> Delete</button>
                </span>`;
            profileFilesListElement.appendChild(li);
        });
        // Add event listeners for new delete buttons
        $$('#profileFilesList .delete-file-btn').forEach(btn => {
            btn.addEventListener('click', () => confirmDeleteProfileDocument(btn.dataset.name, btn.dataset.path));
        });
    } else {
        profileFilesListElement.innerHTML = '<li>No documents uploaded yet.</li>';
    }
}

async function saveProfileDetails(updates, isWizardFinish = false) {
    if (!currentUserId || !fsDb) {
        showMessage("Error", "Not logged in or database not available.", "error");
        return false;
    }
    showLoading("Saving profile...");
    try {
        const profileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        const dataToSave = { ...updates, updatedAt: serverTimestamp() };
        if (isWizardFinish) { // Only set profileSetupComplete on wizard finish
            dataToSave.profileSetupComplete = true;
        }

        await updateDoc(profileDocRef, dataToSave);
        userProfile = { ...userProfile, ...dataToSave }; // Update local profile state
        
        updateProfileDisplay(); // Refresh displayed profile info
        if (!isWizardFinish) { // Don't show this if wizard is finishing (wizard has its own message)
            showMessage("Profile Saved", "Your profile details have been updated.", "success");
        }
        console.log("[DataSave] Profile details updated in Firestore.");
        return true;
    } catch (e) {
        console.error("Profile Save Error:", e);
        logErrorToFirestore("saveProfileDetails", e.message, e);
        showMessage("Save Error", "Could not save profile details: " + e.message, "error");
        return false;
    } finally {
        hideLoading();
    }
}

async function uploadProfileDocuments() {
    if (!profileFileUploadElement || !profileFileUploadElement.files || profileFileUploadElement.files.length === 0) {
        showMessage("No Files", "Please select one or more files to upload.", "info");
        return;
    }
    if (!currentUserId || !fbStorage || !fsDb) {
        showMessage("Error", "Cannot upload: Not logged in or storage/database not available.", "error");
        return;
    }

    const filesToUpload = Array.from(profileFileUploadElement.files);
    showLoading(`Uploading ${filesToUpload.length} file(s)...`);

    const uploadPromises = filesToUpload.map(async (file) => {
        const filePath = `artifacts/${appId}/users/${currentUserId}/profileDocuments/${Date.now()}_${file.name}`;
        const fileRef = ref(fbStorage, filePath);
        try {
            const snapshot = await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            return { name: file.name, url: downloadURL, path: filePath, uploadedAt: serverTimestamp() };
        } catch (e) {
            console.error(`Error uploading ${file.name}:`, e);
            logErrorToFirestore("uploadProfileDocuments.singleUpload", `Failed to upload ${file.name}: ${e.message}`, e);
            throw e; // Re-throw to be caught by Promise.all
        }
    });

    try {
        const uploadedFileObjects = await Promise.all(uploadPromises);
        if (!userProfile.files) userProfile.files = [];
        userProfile.files.push(...uploadedFileObjects);

        // Update Firestore with new file metadata
        const profileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        await updateDoc(profileDocRef, {
            files: arrayUnion(...uploadedFileObjects) // Add new files to the array
        });

        renderProfileFilesList(); // Refresh the list
        showMessage("Upload Successful", `${uploadedFileObjects.length} file(s) uploaded and profile updated.`, "success");
        profileFileUploadElement.value = ""; // Clear file input
    } catch (e) {
        showMessage("Upload Failed", "One or more files could not be uploaded. Please check console for details.", "error");
    } finally {
        hideLoading();
    }
}
// Make confirmDeleteProfileDocument globally accessible if called from HTML, or attach via event listener
window.confirmDeleteProfileDocument = (fileName, filePath) => {
    // Replace with a custom modal confirmation if available
    if (confirm(`Are you sure you want to delete the file "${fileName}"? This action cannot be undone.`)) {
        executeDeleteProfileDocument(fileName, filePath);
    }
};

async function executeDeleteProfileDocument(fileName, filePath) {
    if (!currentUserId || !fbStorage || !fsDb) {
        showMessage("Error", "Cannot delete: Not logged in or storage/database not available.", "error");
        return;
    }
    showLoading(`Deleting ${fileName}...`);
    try {
        // 1. Delete from Firebase Storage
        const fileRef = ref(fbStorage, filePath);
        await deleteObject(fileRef);
        console.log(`[FileDelete] Deleted from Storage: ${filePath}`);

        // 2. Remove from Firestore profile.files array
        const profileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        // Find the file object to remove. Firestore needs the exact object or a query.
        // It's often easier to fetch, filter, and set, but arrayRemove can work if you have the exact object.
        // For simplicity, let's find the object in the local userProfile.files
        const fileToRemove = userProfile.files.find(f => f.path === filePath);
        if (fileToRemove) {
            await updateDoc(profileDocRef, {
                files: arrayRemove(fileToRemove)
            });
            console.log(`[FileDelete] Removed from Firestore profile: ${fileName}`);
            // Update local state
            userProfile.files = userProfile.files.filter(f => f.path !== filePath);
        } else {
            console.warn(`[FileDelete] File object not found in local profile for path: ${filePath}. May need to refresh profile data.`);
            // As a fallback, fetch and update if local state is out of sync
            const currentProfileSnap = await getDoc(profileDocRef);
            if (currentProfileSnap.exists()) {
                const currentFiles = currentProfileSnap.data().files || [];
                const updatedFiles = currentFiles.filter(f => f.path !== filePath);
                await updateDoc(profileDocRef, { files: updatedFiles });
                userProfile.files = updatedFiles;
            }
        }
        renderProfileFilesList(); // Refresh the list
        showMessage("File Deleted", `"${fileName}" has been successfully deleted.`, "success");
    } catch (e) {
        console.error(`Error deleting ${fileName}:`, e);
        logErrorToFirestore("executeDeleteProfileDocument", `Failed to delete ${fileName}: ${e.message}`, e);
        showMessage("Delete Failed", `Could not delete "${fileName}". Error: ${e.message}`, "error");
    } finally {
        hideLoading();
    }
}


/* ========== Invoice Functions ========== */
function renderInvoiceSection() {
    if (!currentUserId || !userProfile) return;
    populateInvoiceHeader();
    renderInvoiceTable(); // This will use currentInvoiceData.items
    updateInvoiceTotals();
    // Load draft if not already loaded or if navigating back to invoice section
    if (!currentInvoiceData.id && userProfile.uid) { // Check if a draft exists and hasn't been loaded
        loadUserInvoiceDraft(); // This will populate currentInvoiceData and re-render
    }
}

function populateInvoiceHeader() {
    if (!invoiceNumberInputElement || !invoiceDateInputElement || !providerNameInputElement || !providerAbnInputElement || !gstFlagInputElement || !userProfile) return;

    invoiceNumberInputElement.value = currentInvoiceData.invoiceNumber || userProfile.nextInvoiceNumber || 'N/A';
    invoiceDateInputElement.value = currentInvoiceData.invoiceDate || formatDateForInput(new Date());
    if (invoiceWeekLabelElement && invoiceDateInputElement.value) {
        invoiceWeekLabelElement.textContent = getWeekNumber(new Date(invoiceDateInputElement.value));
    }

    providerNameInputElement.value = userProfile.name || '';
    providerAbnInputElement.value = userProfile.abn || '';
    gstFlagInputElement.value = userProfile.gstRegistered ? 'Yes' : 'No';

    if (userProfile.gstRegistered) {
        if (gstRowElement) gstRowElement.style.display = 'block'; // Or appropriate display style
    } else {
        if (gstRowElement) gstRowElement.style.display = 'none';
    }
}

function renderInvoiceTable() {
    if (!invoiceTableBodyElement) return;
    invoiceTableBodyElement.innerHTML = ''; // Clear existing rows
    currentInvoiceData.items.forEach((item, index) => {
        addInvoiceRowToTable(item, index);
    });
    updateInvoiceTotals();
}

function addInvoiceRowToTable(item = {}, index = -1) {
    if (!invoiceTableBodyElement) return;
    const newRow = invoiceTableBodyElement.insertRow(index); // index -1 appends
    newRow.dataset.itemId = item.id || generateUniqueId('item_'); // Assign a unique ID to the item/row

    // Populate cells (ensure order matches HTML thead)
    newRow.innerHTML = `
        <td>${invoiceTableBodyElement.rows.length}</td>
        <td><input type="date" class="invoice-input-condensed item-date" value="${item.date || formatDateForInput(new Date())}"></td>
        <td class="column-code print-only pdf-show">
            <span class="code-print-value">${item.serviceCode || ''}</span>
        </td>
        <td>
            <select class="invoice-input-condensed item-description-select">
                <option value="">-- Select Service --</option>
                ${(userProfile.isAdmin ? adminManagedServices : userAuthorizedServices).map(s => `<option value="${s.id}" data-code="${s.code || ''}" ${item.serviceId === s.id ? 'selected' : ''}>${s.description} (${s.code || 'No Code'})</option>`).join('')}
            </select>
            <span class="description-print-value pdf-show" style="display:none;">${item.description || ''}</span>
        </td>
        <td><div class="custom-time-picker-container"><input type="text" class="custom-time-input item-start-time" readonly placeholder="Select Time" value="${item.startTime ? formatTime12Hour(item.startTime) : ''}" data-value24="${item.startTime || ''}"></div></td>
        <td><div class="custom-time-picker-container"><input type="text" class="custom-time-input item-end-time" readonly placeholder="Select Time" value="${item.endTime ? formatTime12Hour(item.endTime) : ''}" data-value24="${item.endTime || ''}"></div></td>
        <td class="column-rate-type print-only pdf-show">
            <span class="rate-type-print-value">${item.rateType || ''}</span>
        </td>
        <td class="print-only-column pdf-show">
            <span class="rate-print-value">${item.rate ? formatCurrency(item.rate) : ''}</span>
        </td>
        <td><input type="number" class="invoice-input-condensed item-hours" value="${item.hours || 0}" readonly></td>
        <td class="no-print pdf-hide"><input type="number" step="0.1" class="invoice-input-condensed item-travel-km" value="${item.travelKm || 0}" ${item.isTravel ? '' : 'disabled'}></td>
        <td class="no-print pdf-hide"><label class="chk no-margin"><input type="checkbox" class="item-claim-travel" ${item.isTravel ? 'checked' : ''}></label></td>
        <td><input type="text" class="invoice-input-condensed item-total" value="${formatCurrency(item.total)}" readonly></td>
        <td class="no-print pdf-hide"><button class="btn-danger btn-small delete-row-btn"><i class="fas fa-trash-alt"></i></button></td>
    `;

    // Add event listeners for new row elements
    const serviceSelect = newRow.querySelector('.item-description-select');
    const startTimeInput = newRow.querySelector('.item-start-time');
    const endTimeInput = newRow.querySelector('.item-end-time');
    const dateInput = newRow.querySelector('.item-date');
    const claimTravelToggle = newRow.querySelector('.item-claim-travel');
    const travelKmInput = newRow.querySelector('.item-travel-km');

    serviceSelect?.addEventListener('change', () => updateInvoiceItemFromRow(newRow, newRow.rowIndex -1));
    dateInput?.addEventListener('change', () => updateInvoiceItemFromRow(newRow, newRow.rowIndex -1));
    startTimeInput?.addEventListener('click', () => openCustomTimePicker(startTimeInput, () => updateInvoiceItemFromRow(newRow, newRow.rowIndex -1)));
    endTimeInput?.addEventListener('click', () => openCustomTimePicker(endTimeInput, () => updateInvoiceItemFromRow(newRow, newRow.rowIndex -1)));
    claimTravelToggle?.addEventListener('change', () => {
        travelKmInput.disabled = !claimTravelToggle.checked;
        if (!claimTravelToggle.checked) travelKmInput.value = 0;
        updateInvoiceItemFromRow(newRow, newRow.rowIndex -1);
    });
    travelKmInput?.addEventListener('input', () => updateInvoiceItemFromRow(newRow, newRow.rowIndex -1));


    newRow.querySelector('.delete-row-btn')?.addEventListener('click', (e) => {
        const rowIndex = e.target.closest('tr').rowIndex - 1; // -1 for header
        currentInvoiceData.items.splice(rowIndex, 1);
        renderInvoiceTable(); // Re-render to update row numbers and totals
    });

    // Trigger initial update if item has data (e.g. when loading draft)
    if (item.serviceId) {
        updateInvoiceItemFromRow(newRow, newRow.rowIndex -1);
    }
}

function addInvRowUserAction() {
    const newItem = {
        id: generateUniqueId('item_'), // Generate a unique ID for the new item
        date: invoiceDateInputElement.value || formatDateForInput(new Date()), // Default to invoice date
        serviceId: '',
        description: '',
        startTime: '',
        endTime: '',
        hours: 0,
        rate: 0,
        total: 0,
        isTravel: false,
        travelKm: 0,
        travelServiceId: null,
        serviceCode: '',
        rateType: ''
    };
    currentInvoiceData.items.push(newItem);
    addInvoiceRowToTable(newItem); // Add to table UI
    updateInvoiceTotals();
}

function updateInvoiceItemFromRow(row, index) {
    if (index < 0 || index >= currentInvoiceData.items.length) return;

    const item = currentInvoiceData.items[index];
    if (!item) return;

    const dateInput = row.querySelector('.item-date');
    const serviceSelect = row.querySelector('.item-description-select');
    const startTimeInput = row.querySelector('.item-start-time');
    const endTimeInput = row.querySelector('.item-end-time');
    const hoursInput = row.querySelector('.item-hours');
    const totalInput = row.querySelector('.item-total');
    const claimTravelToggle = row.querySelector('.item-claim-travel');
    const travelKmInput = row.querySelector('.item-travel-km');

    // For PDF printing spans
    const codePrintSpan = row.querySelector('.code-print-value');
    const descriptionPrintSpan = row.querySelector('.description-print-value');
    const rateTypePrintSpan = row.querySelector('.rate-type-print-value');
    const ratePrintSpan = row.querySelector('.rate-print-value');


    item.date = dateInput.value;
    item.serviceId = serviceSelect.value;
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    item.description = selectedOption ? selectedOption.text.split(' (')[0] : ''; // Get text before code
    item.serviceCode = selectedOption ? selectedOption.dataset.code : '';

    item.startTime = startTimeInput.dataset.value24;
    item.endTime = endTimeInput.dataset.value24;
    item.hours = calculateHours(item.startTime, item.endTime);

    const serviceDetails = (userProfile.isAdmin ? adminManagedServices : userAuthorizedServices).find(s => s.id === item.serviceId);
    let rate = 0;
    item.rateType = '';

    if (serviceDetails) {
        item.rateType = determineRateType(item.date, item.startTime);
        if (serviceDetails.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM || serviceDetails.categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
            rate = parseFloat(serviceDetails.rates?.flat || 0);
            item.rateType = "flat"; // Override for these types
        } else if (serviceDetails.rates && serviceDetails.rates[item.rateType]) {
            rate = parseFloat(serviceDetails.rates[item.rateType] || 0);
        } else if (serviceDetails.rates?.weekday) { // Fallback to weekday if specific rate type not found
            rate = parseFloat(serviceDetails.rates.weekday || 0);
            item.rateType = "weekday"; // Correct rate type if falling back
             console.warn(`Rate for type ${item.rateType} not found for service ${item.serviceId}, falling back to weekday.`);
        } else {
            console.warn(`No rates defined for service ${item.serviceId}`);
        }
    }
    item.rate = rate;

    // Handle travel separately
    item.isTravel = claimTravelToggle.checked;
    item.travelKm = item.isTravel ? parseFloat(travelKmInput.value || 0) : 0;
    let travelTotal = 0;
    if (item.isTravel && item.travelKm > 0 && serviceDetails && serviceDetails.travelCodeId) {
        const travelServiceDetails = adminManagedServices.find(s => s.id === serviceDetails.travelCodeId);
        if (travelServiceDetails && travelServiceDetails.rates?.flat) {
            travelTotal = item.travelKm * parseFloat(travelServiceDetails.rates.flat);
            // Note: The invoice line item itself is for the primary service.
            // Travel is often a separate line item or calculated into the primary service's cost.
            // For this structure, we'll add travelTotal to the item's total.
            // A more robust system might add a separate line item for travel.
        } else {
            console.warn("Associated travel service or its rate not found for service:", serviceDetails.description);
        }
    }
    
    item.total = (item.hours * item.rate) + travelTotal;

    // Update UI fields in the row
    hoursInput.value = item.hours.toFixed(2);
    totalInput.value = formatCurrency(item.total);
    if (travelKmInput) travelKmInput.disabled = !item.isTravel;

    if(codePrintSpan) codePrintSpan.textContent = item.serviceCode;
    if(descriptionPrintSpan) descriptionPrintSpan.textContent = item.description;
    if(rateTypePrintSpan) rateTypePrintSpan.textContent = item.rateType;
    if(ratePrintSpan) ratePrintSpan.textContent = formatCurrency(item.rate);


    updateInvoiceTotals();
}


window.deleteInvoiceRow = (btn) => { // Make it global if called from HTML
    const row = btn.closest('tr');
    if (!row || !invoiceTableBodyElement) return;
    const rowIndex = Array.from(invoiceTableBodyElement.children).indexOf(row); // Get actual index in current items
    if (rowIndex > -1 && rowIndex < currentInvoiceData.items.length) {
        currentInvoiceData.items.splice(rowIndex, 1);
        renderInvoiceTable(); // Re-render to update row numbers and totals
    } else {
        console.warn("Could not delete row, index out of bounds or row not found in data.");
        row.remove(); // Fallback to just removing from UI
        updateInvoiceTotals();
    }
};

function updateInvoiceTotals() {
    let sub = 0;
    currentInvoiceData.items.forEach(item => {
        sub += (item.total || 0);
    });
    currentInvoiceData.subtotal = sub;

    if (userProfile.gstRegistered) {
        currentInvoiceData.gst = sub * 0.10;
        if (gstRowElement) gstRowElement.style.display = 'block'; // Or appropriate display style for table row
    } else {
        currentInvoiceData.gst = 0;
        if (gstRowElement) gstRowElement.style.display = 'none';
    }
    currentInvoiceData.grandTotal = currentInvoiceData.subtotal + currentInvoiceData.gst;

    if (subtotalElement) subtotalElement.textContent = formatCurrency(currentInvoiceData.subtotal);
    if (gstAmountElement) gstAmountElement.textContent = formatCurrency(currentInvoiceData.gst);
    if (grandTotalElement) grandTotalElement.textContent = formatCurrency(currentInvoiceData.grandTotal);
}

async function saveInvoiceDraft() {
    if (!currentUserId || !fsDb) {
        showMessage("Error", "Not logged in or database not available.", "error");
        return;
    }
    if (currentInvoiceData.items.length === 0) {
        showMessage("Empty Invoice", "Cannot save an empty invoice draft. Add some items first.", "info");
        return;
    }

    showLoading("Saving draft...");
    currentInvoiceData.invoiceNumber = invoiceNumberInputElement.value;
    currentInvoiceData.invoiceDate = invoiceDateInputElement.value;
    currentInvoiceData.status = "draft"; // Explicitly set status
    currentInvoiceData.updatedAt = serverTimestamp();

    try {
        const draftDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, "draft"); // Always save to 'draft' doc
        await setDoc(draftDocRef, currentInvoiceData); // Overwrite existing draft
        currentInvoiceData.id = "draft"; // Set ID locally after successful save
        showMessage("Draft Saved", "Your invoice draft has been saved.", "success");
        console.log("[DataSave] Invoice draft saved to Firestore.");

        // Update next invoice number if this draft's number is higher or equal
        const newNextInvoiceNumber = parseInt(currentInvoiceData.invoiceNumber, 10) + 1;
        if (userProfile.nextInvoiceNumber <= parseInt(currentInvoiceData.invoiceNumber, 10)) {
            await saveProfileDetails({ nextInvoiceNumber: newNextInvoiceNumber }, false); // Don't treat as wizard finish
        }

    } catch (e) {
        console.error("Invoice Draft Save Error:", e);
        logErrorToFirestore("saveInvoiceDraft", e.message, e);
        showMessage("Save Error", "Could not save invoice draft: " + e.message, "error");
    } finally {
        hideLoading();
    }
}

async function loadUserInvoiceDraft() {
    if (!currentUserId || !fsDb) return;
    showLoading("Loading invoice draft...");
    try {
        const draftDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, "draft");
        const snap = await getDoc(draftDocRef);
        if (snap.exists()) {
            currentInvoiceData = { ...currentInvoiceData, ...snap.data(), id: snap.id }; // Merge with defaults, ensure ID is set
            console.log("[DataLoad] Invoice draft loaded from Firestore.");
            // Repopulate UI
            populateInvoiceHeader();
            renderInvoiceTable(); // This will use the loaded items
        } else {
            console.log("[DataLoad] No existing invoice draft found.");
            // Reset to default empty state if no draft
            currentInvoiceData = { id: null, items: [], invoiceNumber: userProfile.nextInvoiceNumber?.toString() || "1001", invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0, status: "draft" };
            populateInvoiceHeader();
            renderInvoiceTable();
        }
    } catch (e) {
        console.error("Invoice Draft Load Error:", e);
        logErrorToFirestore("loadUserInvoiceDraft", e.message, e);
        showMessage("Load Error", "Could not load invoice draft.", "error");
    } finally {
        hideLoading();
    }
}

async function saveInitialInvoiceNumber() {
    if (!initialInvoiceNumberInputElement) return;
    const n = parseInt(initialInvoiceNumberInputElement.value, 10);
    if (isNaN(n) || n <= 0) { showMessage("Invalid Number", "Please enter a positive whole number for the starting invoice.", "warning"); return; }

    const success = await saveProfileDetails({ nextInvoiceNumber: n });
    if (success) {
        closeModal('setInitialInvoiceModal');
        if (invoiceNumberInputElement) invoiceNumberInputElement.value = n; // Update current invoice form
        showMessage("Invoice Number Set", `Your next invoice will start from #${n}.`, "success");
    }
}

function generateInvoicePdf() {
    if (!invoicePdfContentElement) {
        showMessage("Error", "Invoice content area not found for PDF generation.", "error");
        return;
    }
    if (currentInvoiceData.items.length === 0) {
        showMessage("Empty Invoice", "Cannot generate PDF for an empty invoice.", "info");
        return;
    }

    showLoading("Generating PDF...");

    // Temporarily show print-only columns for PDF generation
    const printOnlyElements = $$('.print-only, .pdf-show');
    const noPrintElements = $$('.no-print, .pdf-hide');
    printOnlyElements.forEach(el => el.style.display = ''); // Show, or use a class to make them visible
    noPrintElements.forEach(el => el.style.display = 'none'); // Hide

    // Ensure input values are reflected in spans for printing
    invoiceTableBodyElement.querySelectorAll('tr').forEach(row => {
        const serviceSelect = row.querySelector('.item-description-select');
        const startTimeInput = row.querySelector('.item-start-time');
        const endTimeInput = row.querySelector('.item-end-time');

        if (serviceSelect) {
            const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
            row.querySelector('.code-print-value').textContent = selectedOption ? selectedOption.dataset.code : '';
            row.querySelector('.description-print-value').textContent = selectedOption ? selectedOption.text.split(' (')[0] : '';
        }
        // Rate type and rate are already updated by updateInvoiceItemFromRow

        // For start/end times, if you want the 24h format in PDF:
        // row.querySelector('.start-time-print-value').textContent = startTimeInput.dataset.value24;
        // row.querySelector('.end-time-print-value').textContent = endTimeInput.dataset.value24;
    });


    const filename = `Invoice-${invoiceNumberInputElement.value}-${invoiceDateInputElement.value}.pdf`;
    const opt = {
        margin:       [10, 10, 10, 10], // top, left, bottom, right in mm
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(invoicePdfContentElement).set(opt).save()
        .then(() => {
            hideLoading();
            showMessage("PDF Generated", `Invoice ${filename} downloaded.`, "success");
        })
        .catch(err => {
            hideLoading();
            console.error("PDF Generation Error:", err);
            logErrorToFirestore("generateInvoicePdf", err.message, err);
            showMessage("PDF Error", "Could not generate PDF: " + err.message, "error");
        })
        .finally(() => {
            // Revert visibility of print/no-print columns
            printOnlyElements.forEach(el => el.style.display = 'none'); // Hide them back
            noPrintElements.forEach(el => el.style.display = '');
        });
}


/* ========== Agreement Functions ========== */
function renderAgreementSection() {
    if (!currentUserId || !userProfile) return;

    if (userProfile.isAdmin && adminAgreementWorkerSelectorElement && adminSelectWorkerForAgreementElement) {
        adminAgreementWorkerSelectorElement.classList.remove('hide');
        populateAdminWorkerSelectorForAgreement();
        // Admin needs to select a worker to load an agreement
        // Clear current agreement if admin is viewing this tab initially
        if (agreementContentContainerElement) agreementContentContainerElement.innerHTML = '<p>Select a worker to view or manage their service agreement.</p>';
        if (agreementChipElement) agreementChipElement.classList.add('hide');
        if (signAgreementButtonElement) signAgreementButtonElement.classList.add('hide');
        if (participantSignButtonElement) participantSignButtonElement.classList.add('hide');
        if (downloadAgreementPdfButtonElement) downloadAgreementPdfButtonElement.classList.add('hide');

    } else if (!userProfile.isAdmin) {
        if (adminAgreementWorkerSelectorElement) adminAgreementWorkerSelectorElement.classList.add('hide');
        currentAgreementWorkerEmail = currentUserEmail; // For regular users, it's their own agreement
        loadAndRenderServiceAgreement(); // Load current user's agreement
    }
}

function populateAdminWorkerSelectorForAgreement() {
    if (!adminSelectWorkerForAgreementElement || !allUsersCache) return;
    adminSelectWorkerForAgreementElement.innerHTML = '<option value="">-- Select a Support Worker --</option>';
    Object.values(allUsersCache).forEach(worker => {
        if (!worker.isAdmin && worker.approved) { // Only show approved, non-admin workers
            const option = document.createElement('option');
            option.value = worker.email;
            option.textContent = `${worker.name} (${worker.email})`;
            adminSelectWorkerForAgreementElement.appendChild(option);
        }
    });
}

async function loadAndRenderServiceAgreement(workerEmailToLoad = null) {
    // If workerEmailToLoad is null, it implies the current logged-in user (non-admin)
    // If workerEmailToLoad is provided, it's an admin loading a specific worker's agreement
    const targetWorkerEmail = workerEmailToLoad || currentUserEmail;
    if (!targetWorkerEmail) {
        showMessage("Error", "No worker specified for agreement.", "error");
        return;
    }

    let targetWorkerProfile = null;
    if (targetWorkerEmail === currentUserEmail) {
        targetWorkerProfile = userProfile;
    } else if (userProfile.isAdmin && allUsersCache) {
        targetWorkerProfile = Object.values(allUsersCache).find(u => u.email === targetWorkerEmail);
    }

    if (!targetWorkerProfile || !targetWorkerProfile.uid) {
        showMessage("Error", `Could not find profile for worker: ${targetWorkerEmail}`, "error");
        if (agreementContentContainerElement) agreementContentContainerElement.innerHTML = `<p>Could not load agreement. Worker profile not found for ${targetWorkerEmail}.</p>`;
        return;
    }
    
    const targetWorkerUid = targetWorkerProfile.uid;
    currentAgreementWorkerEmail = targetWorkerEmail; // Store whose agreement is being loaded/managed

    showLoading("Loading service agreement...");
    try {
        const agreementDocRef = doc(fsDb, `artifacts/${appId}/users/${targetWorkerUid}/agreements`, "serviceAgreement_v1");
        const agreementSnap = await getDoc(agreementDocRef);

        if (agreementSnap.exists()) {
            currentAgreementData = { id: agreementSnap.id, ...agreementSnap.data() };
            console.log("[DataLoad] Existing service agreement loaded for worker:", targetWorkerEmail);
        } else {
            // Create a new draft agreement structure if one doesn't exist
            console.log("[DataLoad] No existing agreement. Creating new draft structure for worker:", targetWorkerEmail);
            const newAgreementContent = renderAgreementClauses(targetWorkerProfile, globalSettings, null, true); // Get content string
            currentAgreementData = {
                workerId: targetWorkerUid,
                workerEmail: targetWorkerEmail,
                participantSignature: null,
                participantSignatureDate: null,
                workerSignature: null,
                workerSignatureDate: null,
                status: "draft", // "draft", "signed_by_worker", "signed_by_participant", "active" (fully signed)
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                contentSnapshot: newAgreementContent, // Store the initial rendered content
                globalSettingsSnapshot: { // Snapshot relevant global settings at time of creation/last update
                    participantName: globalSettings.defaultParticipantName,
                    participantNdisNo: globalSettings.defaultParticipantNdisNo,
                    planEndDate: globalSettings.defaultPlanEndDate,
                    planManagerName: globalSettings.defaultPlanManagerName,
                    planManagerEmail: globalSettings.defaultPlanManagerEmail,
                    organizationName: globalSettings.organizationName,
                },
                agreementTemplateUsed: JSON.parse(JSON.stringify(agreementCustomData)) // Snapshot of the template used
            };
            // Save this new draft structure to Firestore
            await setDoc(agreementDocRef, currentAgreementData);
            console.log("[DataSave] New draft agreement structure saved for worker:", targetWorkerEmail);
        }

        // Render the agreement content (either from snapshot or freshly generated if logic demands)
        const agreementHtml = currentAgreementData.contentSnapshot || renderAgreementClauses(targetWorkerProfile, globalSettings, currentAgreementData, false);
        if (agreementContentContainerElement) agreementContentContainerElement.innerHTML = agreementHtml;
        
        updateAgreementChip(currentAgreementData.status);
        updateSignatureDisplays(currentAgreementData);
        updateAgreementActionButtons(targetWorkerProfile); // Pass the worker profile for whom agreement is loaded

    } catch (e) {
        console.error("Service Agreement Load/Create Error:", e);
        logErrorToFirestore("loadAndRenderServiceAgreement", e.message, e);
        showMessage("Agreement Error", "Could not load or create service agreement: " + e.message, "error");
        if (agreementContentContainerElement) agreementContentContainerElement.innerHTML = `<p>Error loading agreement: ${e.message}</p>`;
    } finally {
        hideLoading();
    }
}

function renderAgreementClauses(workerProfile, settings, agreementState, returnAsString = false) {
    if (!workerProfile || !settings || !agreementCustomData || !agreementCustomData.clauses) {
        return returnAsString ? "<p>Error: Missing data for agreement generation.</p>" : (agreementContentContainerElement.innerHTML = "<p>Error: Missing data for agreement generation.</p>");
    }

    let html = `<h2>${agreementCustomData.overallTitle || defaultAgreementCustomData.overallTitle}</h2>`;
    if (agreementDynamicTitleElement) agreementDynamicTitleElement.innerHTML = `<i class="fas fa-handshake"></i> ${agreementCustomData.overallTitle || defaultAgreementCustomData.overallTitle}`;


    // Prepare service list for the worker
    // Ensure adminManagedServices is loaded to get full details
    let workerServiceListHtml = "<ul>";
    const servicesToDisplay = adminManagedServices.filter(s => workerProfile.authorizedServices?.includes(s.id));

    if (servicesToDisplay.length > 0) {
        servicesToDisplay.forEach(service => {
            workerServiceListHtml += `<li><strong>${service.code || 'N/A'}:</strong> ${service.description}</li>`;
        });
    } else {
        workerServiceListHtml += "<li>No specific services currently authorized. General support will be provided as agreed.</li>";
    }
    workerServiceListHtml += "</ul>";


    agreementCustomData.clauses.forEach(clause => {
        let clauseBody = clause.body;
        // Replace placeholders
        clauseBody = clauseBody.replace(/\{\{participantName\}\}/g, settings.defaultParticipantName || 'N/A');
        clauseBody = clauseBody.replace(/\{\{participantNdisNo\}\}/g, settings.defaultParticipantNdisNo || 'N/A');
        clauseBody = clauseBody.replace(/\{\{planEndDate\}\}/g, formatDateForDisplay(settings.defaultPlanEndDate) || 'N/A');
        clauseBody = clauseBody.replace(/\{\{workerName\}\}/g, workerProfile.name || 'N/A');
        clauseBody = clauseBody.replace(/\{\{workerAbn\}\}/g, workerProfile.abn || 'N/A');
        clauseBody = clauseBody.replace(/\{\{planManagerName\}\}/g, settings.defaultPlanManagerName || 'N/A');
        clauseBody = clauseBody.replace(/\{\{planManagerEmail\}\}/g, settings.defaultPlanManagerEmail || 'N/A');
        clauseBody = clauseBody.replace(/\{\{serviceList\}\}/g, workerServiceListHtml);
        // Dates might come from agreementState if it's already signed or has specific dates
        clauseBody = clauseBody.replace(/\{\{agreementStartDate\}\}/g, agreementState?.startDate ? formatDateForDisplay(agreementState.startDate) : formatDateForDisplay(new Date()));
        clauseBody = clauseBody.replace(/\{\{agreementEndDate\}\}/g, agreementState?.endDate ? formatDateForDisplay(agreementState.endDate) : formatDateForDisplay(settings.defaultPlanEndDate)); // Default to plan end date

        html += `<h3>${clause.heading}</h3>`;
        html += `<div class="clause-body">${simpleMarkdownToHtml(clauseBody)}</div>`;
    });

    if (returnAsString) {
        return html;
    } else {
        if (agreementContentContainerElement) agreementContentContainerElement.innerHTML = html;
    }
}

function updateSignatureDisplays(agreementData) {
    if (!agreementData) return;
    if (participantSignatureImageElement) {
        participantSignatureImageElement.src = agreementData.participantSignature || 'https://placehold.co/250x85/e8e8e8/666666?text=Signature+Area&txtsize=16';
    }
    if (participantSignatureDateElement) {
        participantSignatureDateElement.textContent = agreementData.participantSignatureDate ? formatDateForDisplay(agreementData.participantSignatureDate) : '___';
    }
    if (workerSignatureImageElement) {
        workerSignatureImageElement.src = agreementData.workerSignature || 'https://placehold.co/250x85/e8e8e8/666666?text=Signature+Area&txtsize=16';
    }
    if (workerSignatureDateElement) {
        workerSignatureDateElement.textContent = agreementData.workerSignatureDate ? formatDateForDisplay(agreementData.workerSignatureDate) : '___';
    }
}


function updateAgreementChip(status) {
    if (!agreementChipElement) return;
    agreementChipElement.classList.remove('hide', 'yellow', 'green', 'blue'); // Blue for partially signed
    let text = '';
    switch (status) {
        case 'draft':
            agreementChipElement.classList.add('yellow');
            text = 'Draft – Awaiting Signatures';
            break;
        case 'signed_by_worker':
            agreementChipElement.classList.add('blue'); // Custom class or use existing
            text = 'Signed by Worker – Awaiting Participant';
            break;
        case 'signed_by_participant':
            agreementChipElement.classList.add('blue');
            text = 'Signed by Participant – Awaiting Worker';
            break;
        case 'active':
            agreementChipElement.classList.add('green');
            text = 'Active – Fully Signed';
            break;
        default:
            agreementChipElement.classList.add('hide'); // Hide if unknown status
            return;
    }
    agreementChipElement.textContent = text;
    agreementChipElement.classList.remove('hide');
}

function updateAgreementActionButtons(targetWorkerProfile) {
    if (!currentAgreementData || !signAgreementButtonElement || !participantSignButtonElement || !downloadAgreementPdfButtonElement) return;

    const isCurrentUserWorker = currentUserId === targetWorkerProfile.uid;
    const isAdmin = userProfile.isAdmin;
    const status = currentAgreementData.status;

    // Worker's own "Sign" button
    signAgreementButtonElement.classList.add('hide');
    if (isCurrentUserWorker && !currentAgreementData.workerSignature && (status === 'draft' || status === 'signed_by_participant')) {
        signAgreementButtonElement.classList.remove('hide');
        signAgreementButtonElement.textContent = "Sign as Support Worker";
        currentSignatureFor = 'worker'; // Set context for signature pad
    }

    // Admin's "Sign for Participant" button
    participantSignButtonElement.classList.add('hide');
    if (isAdmin && !currentAgreementData.participantSignature && (status === 'draft' || status === 'signed_by_worker')) {
        participantSignButtonElement.classList.remove('hide');
        participantSignButtonElement.textContent = "Sign for Participant (Admin)";
        // currentSignatureFor will be set on click
    }
    
    // PDF Download button - show if agreement exists (draft or signed)
    if (currentAgreementData && currentAgreementData.contentSnapshot) {
         downloadAgreementPdfButtonElement.classList.remove('hide');
    } else {
         downloadAgreementPdfButtonElement.classList.add('hide');
    }
}


function openSignatureModal(who) { // who = 'worker' or 'participant'
    signingAs = who; // Set who is currently intended to sign
    currentSignatureFor = who; // Also set context for saveSignature
    if (signatureModalElement) {
        signatureModalElement.querySelector('h3').innerHTML = `<i class="fas fa-pencil-alt"></i> Draw Signature for ${signingAs === 'worker' ? 'Support Worker' : 'Participant'}`;
        openModal('sigModal');
        initializeSignaturePad();
    }
}

function initializeSignaturePad() {
    if (!signatureCanvasElement) return;
    sigCanvas = signatureCanvasElement;
    sigCtx = sigCanvas.getContext('2d');
    sigCtx.strokeStyle = "#000000"; // Black ink
    sigCtx.lineWidth = 2;
    sigCtx.lineCap = "round";
    sigCtx.lineJoin = "round";
    clearSignaturePad(); // Clear any previous drawing

    // Mouse events
    sigCanvas.addEventListener('mousedown', sigStart);
    sigCanvas.addEventListener('mousemove', sigDraw);
    sigCanvas.addEventListener('mouseup', sigEnd);
    sigCanvas.addEventListener('mouseout', sigEnd); // End drawing if mouse leaves canvas

    // Touch events
    sigCanvas.addEventListener('touchstart', sigStart, { passive: false });
    sigCanvas.addEventListener('touchmove', sigDraw, { passive: false });
    sigCanvas.addEventListener('touchend', sigEnd);
}

function clearSignaturePad() {
    if (!sigCtx || !sigCanvas) return;
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    sigPaths = []; // Reset paths
    // Optional: Draw a placeholder line or text
    sigCtx.fillStyle = "#999";
    sigCtx.font = "italic 14px Arial";
    // sigCtx.fillText("Sign here", sigCanvas.width / 2 - 30, sigCanvas.height / 2 + 5);
}

function sigStart(e) {
    e.preventDefault(); // Prevent page scrolling on touch
    sigPen = true;
    const pos = getSigPenPosition(e);
    sigCtx.beginPath();
    sigCtx.moveTo(pos.x, pos.y);
    sigPaths.push([{ x: pos.x, y: pos.y }]); // Start new path
}

function sigDraw(e) {
    e.preventDefault();
    if (!sigPen) return;
    const pos = getSigPenPosition(e);
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.stroke();
    if (sigPaths.length > 0) {
        sigPaths[sigPaths.length - 1].push({ x: pos.x, y: pos.y }); // Add point to current path
    }
}

function sigEnd(e) {
    e.preventDefault();
    sigPen = false;
}

function getSigPenPosition(e) {
    const rect = sigCanvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    return {
        x: (clientX - rect.left) * (sigCanvas.width / rect.width),
        y: (clientY - rect.top) * (sigCanvas.height / rect.height)
    };
}

async function saveSignature() {
    if (!sigCanvas || sigPaths.length === 0) {
        showMessage("No Signature", "Please draw a signature before saving.", "warning");
        return;
    }
    if (!currentAgreementData || !currentSignatureFor) {
        showMessage("Error", "Agreement context not set for saving signature.", "error");
        return;
    }

    const signatureDataUrl = sigCanvas.toDataURL('image/png');
    const signatureDate = serverTimestamp(); // Use server timestamp for reliability

    let updates = {};
    let newStatus = currentAgreementData.status;

    if (currentSignatureFor === 'worker') {
        updates.workerSignature = signatureDataUrl;
        updates.workerSignatureDate = signatureDate;
        if (currentAgreementData.participantSignature) newStatus = 'active';
        else newStatus = 'signed_by_worker';
    } else if (currentSignatureFor === 'participant') {
        updates.participantSignature = signatureDataUrl;
        updates.participantSignatureDate = signatureDate;
        if (currentAgreementData.workerSignature) newStatus = 'active';
        else newStatus = 'signed_by_participant';
    }
    updates.status = newStatus;
    updates.updatedAt = serverTimestamp();

    showLoading("Saving signature...");
    try {
        // Determine whose agreement we are updating
        const targetWorkerForAgreement = Object.values(allUsersCache).find(u => u.email === currentAgreementWorkerEmail) || userProfile;
        if (!targetWorkerForAgreement || !targetWorkerForAgreement.uid) {
             throw new Error("Target worker for agreement not found.");
        }

        const agreementDocRef = doc(fsDb, `artifacts/${appId}/users/${targetWorkerForAgreement.uid}/agreements`, "serviceAgreement_v1");
        await updateDoc(agreementDocRef, updates);

        // Update local currentAgreementData
        currentAgreementData = { ...currentAgreementData, ...updates, status: newStatus };
        // Convert server timestamps to Date objects for local display if needed, or rely on Firestore to do so on next load
        if (updates.workerSignatureDate) currentAgreementData.workerSignatureDate = new Date(); // Approximate for immediate display
        if (updates.participantSignatureDate) currentAgreementData.participantSignatureDate = new Date();


        showMessage("Signature Saved", `Signature for ${currentSignatureFor} saved successfully. Agreement status: ${newStatus}.`, "success");
        closeModal('sigModal');
        updateSignatureDisplays(currentAgreementData);
        updateAgreementChip(newStatus);
        updateAgreementActionButtons(targetWorkerForAgreement);

    } catch (e) {
        console.error("Signature Save Error:", e);
        logErrorToFirestore("saveSignature", e.message, e);
        showMessage("Save Error", "Could not save signature: " + e.message, "error");
    } finally {
        hideLoading();
    }
}

function generateAgreementPdf() {
    if (!agreementContentWrapperElement || !currentAgreementData) {
        showMessage("Error", "Agreement content not found for PDF generation.", "error");
        return;
    }
    showLoading("Generating Agreement PDF...");

    // Prepare a clone of the content for PDF to avoid altering live display too much
    const pdfContentClone = agreementContentWrapperElement.cloneNode(true);
    // Ensure the header for PDF is visible in the clone
    const headerForPdfInClone = pdfContentClone.querySelector("#agreementHeaderForPdf");
    if (headerForPdfInClone) {
        headerForPdfInClone.style.display = "block"; // Make it visible for PDF
        headerForPdfInClone.innerHTML = `<h1>${currentAgreementData.agreementTemplateUsed?.overallTitle || agreementCustomData.overallTitle || 'Service Agreement'}</h1>`;
        if (currentAgreementData.status === 'active') {
            headerForPdfInClone.innerHTML += `<p>Status: Fully Signed</p>`;
        } else {
            headerForPdfInClone.innerHTML += `<p>Status: ${currentAgreementData.status}</p>`;
        }
    }
    // Ensure signature images are actual images, not placeholders if signed
    const sigP_clone = pdfContentClone.querySelector("#sigP");
    const sigW_clone = pdfContentClone.querySelector("#sigW");
    if (currentAgreementData.participantSignature && sigP_clone) sigP_clone.src = currentAgreementData.participantSignature;
    if (currentAgreementData.workerSignature && sigW_clone) sigW_clone.src = currentAgreementData.workerSignature;


    const targetWorkerForAgreement = Object.values(allUsersCache).find(u => u.email === currentAgreementWorkerEmail) || userProfile;
    const workerName = targetWorkerForAgreement.name || "Worker";
    const filename = `ServiceAgreement-${workerName.replace(/\s+/g, '_')}-${formatDateForInput(new Date())}.pdf`;

    const opt = {
        margin:       [15, 12, 15, 12], // top, left, bottom, right in mm
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, scrollY: 0 }, // Ensure it captures from top
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } // Helps with page breaks
    };

    html2pdf().from(pdfContentClone).set(opt).save()
        .then(() => {
            hideLoading();
            showMessage("PDF Generated", `Agreement ${filename} downloaded.`, "success");
        })
        .catch(err => {
            hideLoading();
            console.error("Agreement PDF Generation Error:", err);
            logErrorToFirestore("generateAgreementPdf", err.message, err);
            showMessage("PDF Error", "Could not generate agreement PDF: " + err.message, "error");
        });
}


/* ========== Admin Functions ========== */
function renderAdminDashboard() {
    if (!userProfile.isAdmin) { navigateToSection("home"); return; }
    // Default to the first tab or a specific tab like 'adminGlobalSettings'
    const activeTabBtn = $(".admin-tab-btn.active");
    if (activeTabBtn && activeTabBtn.dataset.target) {
        switchAdminTab(activeTabBtn.dataset.target);
    } else {
        switchAdminTab('adminGlobalSettings'); // Default tab
    }
}

function switchAdminTab(targetId) {
    if (adminNavTabButtons) adminNavTabButtons.forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
    if (adminContentPanels) adminContentPanels.forEach(p => p.classList.toggle('active', p.id === targetId));

    // Load data or render specific content for the activated tab
    switch (targetId) {
        case 'adminGlobalSettings': renderAdminGlobalSettingsTab(); break;
        case 'adminServiceManagement': renderAdminServiceManagementTab(); break;
        case 'adminAgreementCustomization': renderAdminAgreementCustomizationTab(); break;
        case 'adminWorkerManagement': renderAdminWorkerManagementTab(); break;
    }
    console.log(`Admin tab switched to: ${targetId}`);
}

function renderAdminGlobalSettingsTab() {
    if (!globalSettings || !userProfile.isAdmin) return;

    if (adminEditOrgNameInputElement) adminEditOrgNameInputElement.value = globalSettings.organizationName || '';
    if (adminEditOrgAbnInputElement) adminEditOrgAbnInputElement.value = globalSettings.organizationAbn || '';
    if (adminEditOrgContactEmailInputElement) adminEditOrgContactEmailInputElement.value = globalSettings.organizationContactEmail || '';
    if (adminEditOrgContactPhoneInputElement) adminEditOrgContactPhoneInputElement.value = globalSettings.organizationContactPhone || '';

    if (adminEditParticipantNameInputElement) adminEditParticipantNameInputElement.value = globalSettings.defaultParticipantName || '';
    if (adminEditParticipantNdisNoInputElement) adminEditParticipantNdisNoInputElement.value = globalSettings.defaultParticipantNdisNo || '';
    if (adminEditPlanManagerNameInputElement) adminEditPlanManagerNameInputElement.value = globalSettings.defaultPlanManagerName || '';
    if (adminEditPlanManagerEmailInputElement) adminEditPlanManagerEmailInputElement.value = globalSettings.defaultPlanManagerEmail || '';
    if (adminEditPlanManagerPhoneInputElement) adminEditPlanManagerPhoneInputElement.value = globalSettings.defaultPlanManagerPhone || '';
    if (adminEditPlanEndDateInputElement) adminEditPlanEndDateInputElement.value = globalSettings.defaultPlanEndDate ? formatDateForInput(new Date(globalSettings.defaultPlanEndDate)) : '';

    // Invite Link (Example: direct registration link)
    if (inviteLinkCodeElement) {
        const portalUrl = window.location.origin + window.location.pathname;
        inviteLinkCodeElement.textContent = `${portalUrl}#register`; // Simple link to registration page
    }
}

async function saveAdminPortalSettings() {
    if (!userProfile.isAdmin) { showMessage("Unauthorized", "Only admins can save portal settings.", "error"); return; }

    const newSettings = {
        organizationName: adminEditOrgNameInputElement?.value.trim(),
        organizationAbn: adminEditOrgAbnInputElement?.value.trim(),
        organizationContactEmail: adminEditOrgContactEmailInputElement?.value.trim(),
        organizationContactPhone: adminEditOrgContactPhoneInputElement?.value.trim(),
        defaultParticipantName: adminEditParticipantNameInputElement?.value.trim(),
        defaultParticipantNdisNo: adminEditParticipantNdisNoInputElement?.value.trim(),
        defaultPlanManagerName: adminEditPlanManagerNameInputElement?.value.trim(),
        defaultPlanManagerEmail: adminEditPlanManagerEmailInputElement?.value.trim(),
        defaultPlanManagerPhone: adminEditPlanManagerPhoneInputElement?.value.trim(),
        defaultPlanEndDate: adminEditPlanEndDateInputElement?.value, // Already in YYYY-MM-DD
        setupComplete: globalSettings.setupComplete || false, // Preserve existing, or set if part of wizard
        portalType: globalSettings.portalType || "organization", // Preserve existing
        adminEmail: globalSettings.adminEmail || "admin@portal.com" // Preserve existing
        // agreementTemplate is saved separately or via its own tab
    };

    // Validate emails if they are provided
    if (newSettings.organizationContactEmail && !validateEmail(newSettings.organizationContactEmail)) {
        showMessage("Invalid Email", "Organization contact email is not valid.", "warning"); return;
    }
    if (newSettings.defaultPlanManagerEmail && !validateEmail(newSettings.defaultPlanManagerEmail)) {
        showMessage("Invalid Email", "Plan manager email is not valid.", "warning"); return;
    }

    globalSettings = { ...globalSettings, ...newSettings }; // Update local state
    await saveGlobalSettingsToFirestore(); // This function already shows messages
}

window.confirmResetGlobalSettings = () => {
    if (confirm("DANGER! Are you sure you want to reset ALL global portal settings to their original defaults? This action cannot be undone and will affect default agreement data and portal behavior.")) {
        if (confirm("SECOND CONFIRMATION: Resetting will revert organization details, participant defaults, and potentially the agreement template. Proceed?")) {
            executeResetGlobalSettings();
        }
    }
};

async function executeResetGlobalSettings() {
    if (!userProfile.isAdmin) { showMessage("Unauthorized", "Only admins can reset settings.", "error"); return; }
    showLoading("Resetting global settings...");
    globalSettings = getDefaultGlobalSettings(); // Get fresh defaults
    agreementCustomData = JSON.parse(JSON.stringify(defaultAgreementCustomData)); // Reset agreement template too
    globalSettings.agreementTemplate = JSON.parse(JSON.stringify(agreementCustomData)); // Put it into global settings

    const success = await saveGlobalSettingsToFirestore(); // Save these defaults
    if (success) {
        renderAdminGlobalSettingsTab(); // Re-render the tab with new defaults
        renderAdminAgreementCustomizationTab(); // Also re-render agreement tab
        showMessage("Settings Reset", "Global portal settings have been reset to defaults.", "success");
    } else {
        showMessage("Reset Failed", "Could not reset settings. Check console for errors.", "error");
    }
    hideLoading();
}

async function renderAdminServiceManagementTab() {
    if (!userProfile.isAdmin) return;
    if (adminManagedServices.length === 0) { // Load if not already loaded
        await loadAdminServicesFromFirestore();
    }
    clearAdminServiceForm();
    renderAdminServicesTable();
    populateServiceCategoryTypeDropdown(); // For the form
    renderAdminServiceRateFields(); // Initial render based on default category
}

function populateServiceCategoryTypeDropdown() {
    if (!adminServiceCategoryTypeSelectElement) return;
    adminServiceCategoryTypeSelectElement.innerHTML = ''; // Clear existing
    for (const key in SERVICE_CATEGORY_TYPES) {
        const option = document.createElement('option');
        option.value = SERVICE_CATEGORY_TYPES[key];
        // Make descriptions more user-friendly
        let text = key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()); // Title Case
        if (SERVICE_CATEGORY_TYPES[key] === SERVICE_CATEGORY_TYPES.CORE_STANDARD) text = "Core - Standard Rates";
        else if (SERVICE_CATEGORY_TYPES[key] === SERVICE_CATEGORY_TYPES.CORE_HIGH_INTENSITY) text = "Core - High Intensity Rates";
        else if (SERVICE_CATEGORY_TYPES[key] === SERVICE_CATEGORY_TYPES.CAPACITY_THERAPY_STD) text = "Capacity Building - Therapy Standard";
        else if (SERVICE_CATEGORY_TYPES[key] === SERVICE_CATEGORY_TYPES.CAPACITY_SPECIALIST) text = "Capacity Building - Specialist";
        else if (SERVICE_CATEGORY_TYPES[key] === SERVICE_CATEGORY_TYPES.TRAVEL_KM) text = "Travel - Per Kilometre";
        else if (SERVICE_CATEGORY_TYPES[key] === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) text = "Other - Single Flat Rate";
        option.textContent = text;
        adminServiceCategoryTypeSelectElement.appendChild(option);
    }
}

function renderAdminServiceRateFields() {
    if (!adminServiceRateFieldsContainerElement || !adminServiceCategoryTypeSelectElement) return;
    const categoryType = adminServiceCategoryTypeSelectElement.value;
    adminServiceRateFieldsContainerElement.innerHTML = ''; // Clear previous fields

    let fieldsHtml = '';
    if (categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM || categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
        fieldsHtml = `
            <div class="form-group">
                <label for="serviceRate_flat">Rate ($ per Km or Flat Rate):</label>
                <input type="number" id="serviceRate_flat" step="0.01" min="0" placeholder="e.g., 0.85 or 50.00">
            </div>`;
    } else { // For CORE_STANDARD, CORE_HIGH_INTENSITY, CAPACITY_THERAPY_STD, CAPACITY_SPECIALIST
        RATE_CATEGORIES.forEach(rateCat => {
            if (rateCat === "flat") return; // Skip flat for these complex types
            fieldsHtml += `
                <div class="form-group">
                    <label for="serviceRate_${rateCat}">${rateCat.charAt(0).toUpperCase() + rateCat.slice(1)} Rate ($ per hour):</label>
                    <input type="number" id="serviceRate_${rateCat}" step="0.01" min="0" placeholder="e.g., 55.75">
                </div>`;
        });
    }
    adminServiceRateFieldsContainerElement.innerHTML = `<div class="rate-inputs-grid">${fieldsHtml}</div>`;

    // If editing, populate fields
    if (currentAdminServiceEditingId) {
        const service = adminManagedServices.find(s => s.id === currentAdminServiceEditingId);
        if (service && service.rates) {
            if (categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM || categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
                const flatRateInput = $(`#serviceRate_flat`);
                if (flatRateInput) flatRateInput.value = service.rates.flat || '';
            } else {
                RATE_CATEGORIES.forEach(rateCat => {
                    if (rateCat === "flat") return;
                    const rateInput = $(`#serviceRate_${rateCat}`);
                    if (rateInput) rateInput.value = service.rates[rateCat] || '';
                });
            }
        }
    }
}


function clearAdminServiceForm() {
    if (adminServiceIdInputElement) adminServiceIdInputElement.value = '';
    if (adminServiceCodeInputElement) adminServiceCodeInputElement.value = '';
    if (adminServiceDescriptionInputElement) adminServiceDescriptionInputElement.value = '';
    if (adminServiceCategoryTypeSelectElement) adminServiceCategoryTypeSelectElement.value = SERVICE_CATEGORY_TYPES.CORE_STANDARD; // Default
    if (adminServiceTravelCodeInputElement) adminServiceTravelCodeInputElement.value = '';
    if (adminServiceTravelCodeDisplayElement) adminServiceTravelCodeDisplayElement.value = 'None selected';
    currentAdminServiceEditingId = null;
    renderAdminServiceRateFields(); // Clears and re-renders rate fields for the default category
    if (saveAdminServiceButtonElement) saveAdminServiceButtonElement.innerHTML = '<i class="fas fa-save"></i> Add New Service';
}

function renderAdminServicesTable() {
    if (!adminServicesTableBodyElement) return;
    adminServicesTableBodyElement.innerHTML = '';
    adminManagedServices.forEach(service => {
        const row = adminServicesTableBodyElement.insertRow();
        const primaryRateKey = Object.keys(service.rates || {}).find(k => k !== 'flat' && service.rates[k]) || 'flat';
        const primaryRate = service.rates ? (service.rates[primaryRateKey] || service.rates.flat || 0) : 0;
        const travelService = service.travelCodeId ? adminManagedServices.find(s => s.id === service.travelCodeId) : null;

        row.innerHTML = `
            <td>${service.code || 'N/A'}</td>
            <td>${service.description || 'N/A'}</td>
            <td>${(Object.keys(SERVICE_CATEGORY_TYPES).find(key => SERVICE_CATEGORY_TYPES[key] === service.categoryType) || service.categoryType || '').replace(/_/g, ' ')}</td>
            <td>${formatCurrency(primaryRate)} ${service.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM ? '/km' : (service.categoryType !== SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE ? '/hr' : '')}</td>
            <td>${travelService ? `${travelService.code} (${travelService.description.substring(0,20)}...)` : 'None'}</td>
            <td>
                <button class="btn-secondary btn-small edit-service-btn" data-id="${service.id}"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-danger btn-small delete-service-btn" data-id="${service.id}"><i class="fas fa-trash-alt"></i> Delete</button>
            </td>
        `;
        row.querySelector('.edit-service-btn').addEventListener('click', () => editAdminService(service.id));
        row.querySelector('.delete-service-btn').addEventListener('click', () => deleteAdminService(service.id));
    });
}

window.editAdminService = (id) => { // Made global for dynamic buttons
    const service = adminManagedServices.find(s => s.id === id);
    if (!service) { showMessage("Error", "Service not found for editing.", "error"); return; }

    currentAdminServiceEditingId = id;
    if (adminServiceIdInputElement) adminServiceIdInputElement.value = id;
    if (adminServiceCodeInputElement) adminServiceCodeInputElement.value = service.code || '';
    if (adminServiceDescriptionInputElement) adminServiceDescriptionInputElement.value = service.description || '';
    if (adminServiceCategoryTypeSelectElement) adminServiceCategoryTypeSelectElement.value = service.categoryType || SERVICE_CATEGORY_TYPES.CORE_STANDARD;
    
    renderAdminServiceRateFields(); // This will populate based on currentAdminServiceEditingId and selected category

    const travelService = service.travelCodeId ? adminManagedServices.find(s => s.id === service.travelCodeId) : null;
    if (adminServiceTravelCodeInputElement) adminServiceTravelCodeInputElement.value = service.travelCodeId || '';
    if (adminServiceTravelCodeDisplayElement) adminServiceTravelCodeDisplayElement.value = travelService ? `${travelService.code} - ${travelService.description}` : 'None selected';
    
    if (saveAdminServiceButtonElement) saveAdminServiceButtonElement.innerHTML = '<i class="fas fa-save"></i> Update Service';
    adminServiceCodeInputElement.focus(); // Focus on the first editable field
};

window.deleteAdminService = (id) => { // Made global
    if (confirm(`Are you sure you want to delete service with ID: ${id}? This cannot be undone and might affect existing data if this service is in use.`)) {
        _confirmDeleteServiceFirestore(id);
    }
};

async function _confirmDeleteServiceFirestore(id) {
    if (!userProfile.isAdmin || !fsDb) { showMessage("Error", "Unauthorized or DB not available.", "error"); return; }
    showLoading("Deleting service...");
    try {
        await deleteDoc(doc(fsDb, `artifacts/${appId}/public/services`, id));
        adminManagedServices = adminManagedServices.filter(s => s.id !== id); // Update local cache
        renderAdminServicesTable(); // Refresh table
        clearAdminServiceForm(); // If it was being edited
        showMessage("Service Deleted", `Service ID ${id} has been deleted.`, "success");
    } catch (e) {
        console.error("Service Delete Error:", e);
        logErrorToFirestore("_confirmDeleteServiceFirestore", e.message, e);
        showMessage("Delete Error", "Could not delete service: " + e.message, "error");
    } finally {
        hideLoading();
    }
}

async function saveAdminServiceToFirestore() {
    if (!userProfile.isAdmin || !fsDb) { showMessage("Error", "Unauthorized or DB not available.", "error"); return; }

    const serviceData = {
        code: adminServiceCodeInputElement?.value.trim() || null, // Allow null if empty
        description: adminServiceDescriptionInputElement?.value.trim(),
        categoryType: adminServiceCategoryTypeSelectElement?.value,
        rates: {},
        travelCodeId: adminServiceTravelCodeInputElement?.value || null, // ID of another service item
        updatedAt: serverTimestamp()
    };

    if (!serviceData.description || !serviceData.categoryType) {
        showMessage("Validation Error", "Service description and category type are required.", "warning");
        return;
    }

    // Collect rates based on category type
    if (serviceData.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM || serviceData.categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
        const flatRate = parseFloat($(`#serviceRate_flat`)?.value);
        if (!isNaN(flatRate) && flatRate >=0) serviceData.rates.flat = flatRate;
        else { showMessage("Validation Error", "Valid flat rate is required.", "warning"); return; }
    } else {
        let hasAtLeastOneRate = false;
        RATE_CATEGORIES.forEach(rateCat => {
            if (rateCat === "flat") return;
            const rateVal = parseFloat($(`#serviceRate_${rateCat}`)?.value);
            if (!isNaN(rateVal) && rateVal >=0) {
                 serviceData.rates[rateCat] = rateVal;
                 hasAtLeastOneRate = true;
            } else {
                serviceData.rates[rateCat] = 0; // Default to 0 if not set or invalid, but NDIS might require them.
            }
        });
        if (!hasAtLeastOneRate && (serviceData.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM && serviceData.categoryType !== SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) ) {
            // For complex rate types, at least one rate should ideally be set.
            // Depending on strictness, you might warn or error.
            // For now, we allow saving with 0 rates, but it's not practical.
            console.warn("Saving service with no defined hourly rates for a complex category type.");
        }
    }


    showLoading(currentAdminServiceEditingId ? "Updating service..." : "Adding service...");
    try {
        let serviceDocRef;
        if (currentAdminServiceEditingId) { // Update existing
            serviceDocRef = doc(fsDb, `artifacts/${appId}/public/services`, currentAdminServiceEditingId);
            await updateDoc(serviceDocRef, serviceData);
            // Update in local cache
            const index = adminManagedServices.findIndex(s => s.id === currentAdminServiceEditingId);
            if (index > -1) adminManagedServices[index] = { ...adminManagedServices[index], ...serviceData, id: currentAdminServiceEditingId };
            showMessage("Service Updated", "Service details have been updated.", "success");
        } else { // Add new
            serviceData.createdAt = serverTimestamp();
            serviceDocRef = await fsAddDoc(collection(fsDb, `artifacts/${appId}/public/services`), serviceData);
            adminManagedServices.push({ ...serviceData, id: serviceDocRef.id }); // Add to local cache
            showMessage("Service Added", "New service has been added.", "success");
        }
        adminManagedServices.sort((a, b) => (a.code || "").localeCompare(b.code || "")); // Re-sort
        renderAdminServicesTable();
        clearAdminServiceForm();
    } catch (e) {
        console.error("Service Save Error:", e);
        logErrorToFirestore("saveAdminServiceToFirestore", e.message, e);
        showMessage("Save Error", "Could not save service: " + e.message, "error");
    } finally {
        hideLoading();
    }
}

function openTravelCodeSelectionModal() {
    if (!travelCodeListContainerElement || !adminManagedServices) return;
    travelCodeListContainerElement.innerHTML = ''; // Clear previous list

    const travelServices = adminManagedServices.filter(s => s.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM);

    if (travelServices.length === 0) {
        travelCodeListContainerElement.innerHTML = '<p>No travel-specific services (per Km) have been defined yet. Please add one in the NDIS Services tab first.</p>';
    } else {
        const ul = document.createElement('ul');
        ul.className = 'modal-selectable-list';
        travelServices.forEach(service => {
            const li = document.createElement('li');
            li.textContent = `${service.code || 'No Code'} - ${service.description} (${formatCurrency(service.rates?.flat || 0)}/km)`;
            li.dataset.serviceId = service.id;
            li.dataset.serviceCode = service.code || '';
            li.dataset.serviceDescription = service.description || '';
            li.addEventListener('click', () => {
                // Handle selection visually (e.g., add 'selected' class)
                ul.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
                li.classList.add('selected');
            });
            ul.appendChild(li);
        });
        travelCodeListContainerElement.appendChild(ul);
    }
    if (travelCodeFilterInputElement) travelCodeFilterInputElement.value = ''; // Clear filter
    openModal('travelCodeSelectionModal');
}
if (confirmTravelCodeSelectionButtonElement) {
    confirmTravelCodeSelectionButtonElement.addEventListener('click', () => {
        const selectedLi = travelCodeListContainerElement.querySelector('li.selected');
        if (selectedLi && adminServiceTravelCodeInputElement && adminServiceTravelCodeDisplayElement) {
            adminServiceTravelCodeInputElement.value = selectedLi.dataset.serviceId;
            adminServiceTravelCodeDisplayElement.value = `${selectedLi.dataset.serviceCode} - ${selectedLi.dataset.serviceDescription}`;
            closeModal('travelCodeSelectionModal');
        } else {
            showMessage("No Selection", "Please select a travel service code from the list.", "info");
        }
    });
}
if (travelCodeFilterInputElement && travelCodeListContainerElement) {
    travelCodeFilterInputElement.addEventListener('input', (e) => {
        const filterText = e.target.value.toLowerCase();
        travelCodeListContainerElement.querySelectorAll('li').forEach(li => {
            const serviceText = li.textContent.toLowerCase();
            li.style.display = serviceText.includes(filterText) ? '' : 'none';
        });
    });
}


function renderAdminAgreementCustomizationTab() {
    if (!userProfile.isAdmin || !globalSettings.agreementTemplate || !adminAgreementOverallTitleInputElement || !adminAgreementClausesContainerElement) return;
    
    agreementCustomData = JSON.parse(JSON.stringify(globalSettings.agreementTemplate || defaultAgreementCustomData));

    adminAgreementOverallTitleInputElement.value = agreementCustomData.overallTitle || '';
    renderAdminAgreementClausesEditor();
    updateAdminAgreementPreview();
}

function renderAdminAgreementClausesEditor() {
    if (!adminAgreementClausesContainerElement || !agreementCustomData.clauses) return;
    adminAgreementClausesContainerElement.innerHTML = ''; // Clear existing

    agreementCustomData.clauses.forEach((clause, index) => {
        const clauseDiv = document.createElement('div');
        clauseDiv.className = 'agreement-clause-editor';
        clauseDiv.innerHTML = `
            <div class="form-group">
                <label for="clauseHeading_${index}">Clause Heading (e.g., ${clause.id})</label>
                <input type="text" id="clauseHeading_${index}" value="${clause.heading}">
            </div>
            <div class="form-group">
                <label for="clauseBody_${index}">Clause Body (Markdown & Placeholders like {{participantName}} allowed)</label>
                <textarea id="clauseBody_${index}" rows="5">${clause.body}</textarea>
            </div>
            <button class="btn-danger btn-small remove-clause-btn" data-index="${index}"><i class="fas fa-times"></i> Remove Clause</button>
            <hr class="compact-hr">
        `;
        adminAgreementClausesContainerElement.appendChild(clauseDiv);

        // Add event listeners for input changes to update agreementCustomData
        clauseDiv.querySelector(`#clauseHeading_${index}`).addEventListener('input', (e) => {
            agreementCustomData.clauses[index].heading = e.target.value;
            updateAdminAgreementPreview(); // Live preview update
        });
        clauseDiv.querySelector(`#clauseBody_${index}`).addEventListener('input', (e) => {
            agreementCustomData.clauses[index].body = e.target.value;
            updateAdminAgreementPreview();
        });
        clauseDiv.querySelector('.remove-clause-btn').addEventListener('click', (e) => {
            if (confirm("Are you sure you want to remove this clause?")) {
                agreementCustomData.clauses.splice(index, 1);
                renderAdminAgreementClausesEditor(); // Re-render clauses
                updateAdminAgreementPreview();
            }
        });
    });
}

function addAdminAgreementClauseEditor() {
    if (!agreementCustomData.clauses) agreementCustomData.clauses = [];
    const newClauseId = `customClause${Date.now()}`;
    agreementCustomData.clauses.push({
        id: newClauseId,
        heading: "New Custom Clause",
        body: "Enter content here. Use placeholders like {{workerName}} or {{participantName}}."
    });
    renderAdminAgreementClausesEditor(); // Re-render all clause editors
    updateAdminAgreementPreview();
    // Scroll to the new clause editor if possible
    const newEditor = adminAgreementClausesContainerElement.lastElementChild;
    if (newEditor) newEditor.scrollIntoView({ behavior: 'smooth' });
}


function updateAdminAgreementPreview() {
    if (!adminAgreementPreviewElement || !agreementCustomData) return;
    let previewHtml = `<h2>${adminAgreementOverallTitleInputElement?.value || agreementCustomData.overallTitle || 'Service Agreement'}</h2>`;
    if (agreementCustomData.clauses) {
        agreementCustomData.clauses.forEach(clause => {
            previewHtml += `<h3>${clause.heading}</h3>`;
            // Basic placeholder replacement for preview - actual replacement happens during real agreement generation
            let previewBody = clause.body.replace(/\{\{(.*?)\}\}/g, '<span class="placeholder-preview">[$1]</span>');
            previewHtml += `<div class="clause-body-preview">${simpleMarkdownToHtml(previewBody)}</div>`;
        });
    } else {
        previewHtml += "<p><em>No clauses defined yet.</em></p>";
    }
    adminAgreementPreviewElement.innerHTML = previewHtml;
}


async function saveAdminAgreementCustomizationsToFirestore() {
    if (!userProfile.isAdmin || !adminAgreementOverallTitleInputElement) {
        showMessage("Error", "Unauthorized or form elements missing.", "error");
        return;
    }
    showLoading("Saving agreement template...");
    agreementCustomData.overallTitle = adminAgreementOverallTitleInputElement.value.trim();
    // Clause data is already updated in agreementCustomData by input listeners

    globalSettings.agreementTemplate = JSON.parse(JSON.stringify(agreementCustomData)); // Update the template in globalSettings
    
    const success = await saveGlobalSettingsToFirestore(); // This will save the entire globalSettings object
    if (success) {
        showMessage("Agreement Template Saved", "The service agreement template has been updated.", "success");
    } else {
        showMessage("Save Failed", "Could not save the agreement template.", "error");
    }
    hideLoading();
}

async function renderAdminWorkerManagementTab() {
    if (!userProfile.isAdmin) return;
    // Ensure all users are loaded before proceeding
    if (Object.keys(allUsersCache).length === 0) {
        await loadAllUsersForAdmin();
    }
    // Ensure services are loaded
    if (adminManagedServices.length === 0) {
        await loadAdminServicesFromFirestore();
    }
    await loadPendingApprovalWorkers();
    await loadApprovedWorkersForAuthManagement();
    // Clear selection details
    if(selectedWorkerNameForAuthElement) selectedWorkerNameForAuthElement.textContent = "Select an Approved Worker to Manage Services";
    if(servicesForWorkerContainerElement) servicesForWorkerContainerElement.classList.add('hide');

}

async function loadPendingApprovalWorkers() {
    if (!pendingWorkersListElement || !noPendingWorkersMessageElement) return;
    pendingWorkersListElement.innerHTML = ''; // Clear list
    let hasPending = false;

    // Iterate through allUsersCache as it should be up-to-date
    Object.values(allUsersCache).forEach(worker => {
        if (!worker.isAdmin && !worker.approved) {
            hasPending = true;
            const div = document.createElement('div');
            div.className = 'pending-worker-item'; // Add a class for styling
            div.innerHTML = `
                <span><strong>${worker.name || worker.email}</strong> (${worker.email})</span>
                <span>
                    Registered: ${worker.createdAt ? formatDateForDisplay(worker.createdAt.toDate ? worker.createdAt.toDate() : new Date(worker.createdAt)) : 'N/A'}
                    <button class="btn-primary btn-small approve-worker-btn" data-uid="${worker.uid}"><i class="fas fa-check"></i> Approve</button>
                    <button class="btn-danger btn-small deny-worker-btn" data-uid="${worker.uid}"><i class="fas fa-times"></i> Deny</button>
                </span>`;
            pendingWorkersListElement.appendChild(div);
        }
    });

    if (hasPending) {
        noPendingWorkersMessageElement.style.display = 'none';
        // Add event listeners for new buttons
        $$('.approve-worker-btn').forEach(btn => btn.addEventListener('click', () => approveWorkerInFirestore(btn.dataset.uid)));
        $$('.deny-worker-btn').forEach(btn => btn.addEventListener('click', () => denyWorkerInFirestore(btn.dataset.uid)));
    } else {
        noPendingWorkersMessageElement.style.display = 'block';
    }
}


window.approveWorkerInFirestore = async (uid) => {
    if (!userProfile.isAdmin || !fsDb || !uid) { showMessage("Error", "Unauthorized or DB not available.", "error"); return; }
    if (confirm(`Are you sure you want to approve worker with UID: ${uid}?`)) {
        showLoading("Approving worker...");
        try {
            const workerProfileRef = doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details");
            await updateDoc(workerProfileRef, { approved: true, approvedAt: serverTimestamp() });
            
            // Update local cache
            if (allUsersCache[uid]) allUsersCache[uid].approved = true;
            
            showMessage("Worker Approved", `Worker ${allUsersCache[uid]?.email || uid} has been approved.`, "success");
            await loadPendingApprovalWorkers(); // Refresh pending list
            await loadApprovedWorkersForAuthManagement(); // Refresh approved list for auth
        } catch (e) {
            console.error("Worker Approve Error:", e);
            logErrorToFirestore("approveWorkerInFirestore", e.message, e);
            showMessage("Approve Error", "Could not approve worker: " + e.message, "error");
        } finally {
            hideLoading();
        }
    }
};

window.denyWorkerInFirestore = async (uid) => {
    if (!userProfile.isAdmin || !fsDb || !uid) { showMessage("Error", "Unauthorized or DB not available.", "error"); return; }
    // Denying could mean deleting the user or marking them as denied. Deleting is cleaner if they are not to be reconsidered.
    if (confirm(`Are you sure you want to DENY and DELETE worker with UID: ${uid}? This action is permanent.`)) {
        showLoading("Denying and deleting worker...");
        try {
            // For a full denial, you might delete their profile document.
            // Or, mark as denied if you want to keep a record. For this example, we delete.
            const workerProfileRef = doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details");
            await deleteDoc(workerProfileRef);
            // Note: This does NOT delete their Firebase Auth user. That's a separate Admin SDK operation.
            // For client-side, we can only remove their data from our app's Firestore.

            // Remove from local cache
            delete allUsersCache[uid];

            showMessage("Worker Denied", `Worker ${uid} has been denied and their profile data removed.`, "success");
            await loadPendingApprovalWorkers(); // Refresh pending list
        } catch (e) {
            console.error("Worker Deny Error:", e);
            logErrorToFirestore("denyWorkerInFirestore", e.message, e);
            showMessage("Deny Error", "Could not deny worker: " + e.message, "error");
        } finally {
            hideLoading();
        }
    }
};

async function loadApprovedWorkersForAuthManagement() {
    if (!workersListForAuthElement) return;
    workersListForAuthElement.innerHTML = ''; // Clear list

    Object.values(allUsersCache).forEach(worker => {
        if (!worker.isAdmin && worker.approved) {
            const li = document.createElement('li');
            li.textContent = `${worker.name || worker.email} (${worker.email})`;
            li.dataset.uid = worker.uid;
            li.dataset.email = worker.email; // Store email for selection
            li.addEventListener('click', () => selectWorkerForAuth(worker.uid, worker.name || worker.email, worker.email));
            workersListForAuthElement.appendChild(li);
        }
    });
     if (workersListForAuthElement.children.length === 0) {
        workersListForAuthElement.innerHTML = '<li>No approved workers found.</li>';
    }
}

window.selectWorkerForAuth = (uid, name, email) => {
    if (!selectedWorkerNameForAuthElement || !servicesForWorkerContainerElement || !servicesListCheckboxesElement || !adminManagedServices) return;

    // Highlight selected worker in the list
    workersListForAuthElement.querySelectorAll('li').forEach(item => {
        item.classList.toggle('selected', item.dataset.uid === uid);
    });
    
    selectedWorkerEmailForAuth = email; // Store the email of the worker being configured
    selectedWorkerNameForAuthElement.innerHTML = `<i class="fas fa-user-shield"></i> Services for: <strong>${name}</strong>`;
    servicesForWorkerContainerElement.classList.remove('hide');
    servicesListCheckboxesElement.innerHTML = ''; // Clear previous checkboxes

    const workerProfile = allUsersCache[uid];
    const currentAuthorizedServices = workerProfile?.authorizedServices || [];

    if (adminManagedServices.length === 0) {
        servicesListCheckboxesElement.innerHTML = '<li>No NDIS services defined by admin yet.</li>';
        return;
    }

    adminManagedServices.forEach(service => {
        const li = document.createElement('li');
        const checkboxId = `service_auth_${service.id}_${uid}`; // Unique ID for checkbox
        li.innerHTML = `
            <label for="${checkboxId}" class="chk no-margin">
                <input type="checkbox" id="${checkboxId}" value="${service.id}" ${currentAuthorizedServices.includes(service.id) ? 'checked' : ''}>
                ${service.description} (${service.code || 'No Code'})
            </label>`;
        servicesListCheckboxesElement.appendChild(li);
    });
};

async function saveWorkerAuthorizationsToFirestore() {
    if (!selectedWorkerEmailForAuth || !servicesListCheckboxesElement) {
        showMessage("Error", "No worker selected or services list not found.", "error");
        return;
    }

    const workerProfile = Object.values(allUsersCache).find(u => u.email === selectedWorkerEmailForAuth);
    if (!workerProfile || !workerProfile.uid) {
        showMessage("Error", "Selected worker profile not found.", "error");
        return;
    }
    const workerUid = workerProfile.uid;

    const selectedServiceIds = [];
    servicesListCheckboxesElement.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        selectedServiceIds.push(cb.value);
    });

    showLoading(`Saving authorizations for ${workerProfile.name || workerProfile.email}...`);
    try {
        const workerProfileRef = doc(fsDb, `artifacts/${appId}/users/${workerUid}/profile`, "details");
        await updateDoc(workerProfileRef, {
            authorizedServices: selectedServiceIds,
            updatedAt: serverTimestamp()
        });

        // Update local cache
        if (allUsersCache[workerUid]) {
            allUsersCache[workerUid].authorizedServices = selectedServiceIds;
        }
        // If the updated worker is the current user (e.g. admin editing their own non-admin profile, unlikely but possible)
        if (currentUserId === workerUid) {
            userProfile.authorizedServices = selectedServiceIds;
            await loadUserAuthorizedServices(); // Reload their specific services list
        }


        showMessage("Authorizations Saved", `Service authorizations for ${workerProfile.name || workerProfile.email} have been updated.`, "success");
    } catch (e) {
        console.error("Worker Authorizations Save Error:", e);
        logErrorToFirestore("saveWorkerAuthorizationsToFirestore", e.message, e);
        showMessage("Save Error", "Could not save authorizations: " + e.message, "error");
    } finally {
        hideLoading();
    }
}


/* ========== Modal & Wizard Functions ========== */

// Shift Request Modal
function openRequestShiftModal() {
    if (!requestShiftModalElement) return;
    // Reset form
    if(requestDateInputElement) requestDateInputElement.value = formatDateForInput(new Date());
    if(requestStartTimeInputElement) { requestStartTimeInputElement.value = ''; requestStartTimeInputElement.dataset.value24 = ''; }
    if(requestEndTimeInputElement) { requestEndTimeInputElement.value = ''; requestEndTimeInputElement.dataset.value24 = ''; }
    if(requestReasonTextareaElement) requestReasonTextareaElement.value = '';
    openModal('rqModal');
}

async function saveShiftRequest() {
    if (!requestDateInputElement || !requestStartTimeInputElement || !requestEndTimeInputElement || !requestReasonTextareaElement || !currentUserId) {
        showMessage("Error", "Form elements missing or not logged in.", "error");
        return;
    }
    const requestData = {
        userId: currentUserId,
        userEmail: currentUserEmail,
        userName: userProfile.name,
        date: requestDateInputElement.value,
        startTime: requestStartTimeInputElement.dataset.value24,
        endTime: requestEndTimeInputElement.dataset.value24,
        reason: requestReasonTextareaElement.value.trim(),
        status: "pending", // "pending", "approved", "declined"
        requestedAt: serverTimestamp()
    };

    if (!requestData.date || !requestData.startTime || !requestData.endTime) {
        showMessage("Validation Error", "Date, start time, and end time are required for a shift request.", "warning");
        return;
    }
    if (timeToMinutes(requestData.endTime) <= timeToMinutes(requestData.startTime)) {
        showMessage("Validation Error", "End time must be after start time.", "warning");
        return;
    }

    showLoading("Submitting shift request...");
    try {
        // Store shift requests in a public collection for admin review, or user-specific if only for their record
        // For admin review, a public path is better.
        const requestsCollectionRef = collection(fsDb, `artifacts/${appId}/public/data/shiftRequests`);
        await fsAddDoc(requestsCollectionRef, requestData);
        showMessage("Request Submitted", "Your shift request has been submitted for review.", "success");
        closeModal('rqModal');
        await loadUserShiftRequests(); // Refresh the list on home page
    } catch (e) {
        console.error("Shift Request Save Error:", e);
        logErrorToFirestore("saveShiftRequest", e.message, e);
        showMessage("Submit Error", "Could not submit shift request: " + e.message, "error");
    } finally {
        hideLoading();
    }
}

async function loadUserShiftRequests() {
    if (!currentUserId || !fsDb || !shiftRequestsTableBodyElement) return;
    showLoading("Loading shift requests...");
    shiftRequestsTableBodyElement.innerHTML = '<tr><td colspan="5">Loading requests...</td></tr>';
    try {
        const q = query(
            collection(fsDb, `artifacts/${appId}/public/data/shiftRequests`),
            where("userId", "==", currentUserId)
            // orderBy("requestedAt", "desc") // Requires composite index if not just filtering by userId
        );
        const querySnapshot = await getDocs(q);
        const requests = [];
        querySnapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
        
        // Sort in memory to avoid index issues for now
        requests.sort((a,b) => (b.requestedAt?.toDate() || 0) - (a.requestedAt?.toDate() || 0));


        shiftRequestsTableBodyElement.innerHTML = ''; // Clear loading message
        if (requests.length === 0) {
            shiftRequestsTableBodyElement.innerHTML = '<tr><td colspan="5">You have no pending or past shift requests.</td></tr>';
        } else {
            requests.forEach(req => {
                const row = shiftRequestsTableBodyElement.insertRow();
                row.innerHTML = `
                    <td>${formatDateForDisplay(req.date)}</td>
                    <td>${formatTime12Hour(req.startTime)}</td>
                    <td>${formatTime12Hour(req.endTime)}</td>
                    <td>${req.reason || 'N/A'}</td>
                    <td><span class="chip ${req.status === 'approved' ? 'green' : req.status === 'declined' ? 'danger' : 'yellow'}">${req.status}</span></td>
                `;
            });
        }
        $('#shiftRequestsContainer')?.classList.remove('hide');

    } catch (e) {
        console.error("Error loading shift requests:", e);
        logErrorToFirestore("loadUserShiftRequests", e.message, e);
        shiftRequestsTableBodyElement.innerHTML = '<tr><td colspan="5">Could not load shift requests.</td></tr>';
    } finally {
        hideLoading();
    }
}


// Log Shift Modal
function openLogShiftModal() {
    if (!logShiftModalElement || !logShiftSupportTypeSelectElement) return;
    // Reset form
    if(logShiftDateInputElement) logShiftDateInputElement.value = formatDateForInput(new Date());
    if(logShiftStartTimeInputElement) { logShiftStartTimeInputElement.value = ''; logShiftStartTimeInputElement.dataset.value24 = ''; }
    if(logShiftEndTimeInputElement) { logShiftEndTimeInputElement.value = ''; logShiftEndTimeInputElement.dataset.value24 = ''; }
    if(logShiftClaimTravelToggleElement) logShiftClaimTravelToggleElement.checked = false;
    if(logShiftKmFieldsContainerElement) logShiftKmFieldsContainerElement.classList.add('hide');
    if(logShiftStartKmInputElement) logShiftStartKmInputElement.value = '';
    if(logShiftEndKmInputElement) logShiftEndKmInputElement.value = '';
    if(logShiftCalculatedKmElement) logShiftCalculatedKmElement.textContent = '0.0 Km';

    // Populate support type dropdown
    logShiftSupportTypeSelectElement.innerHTML = '<option value="">-- Select Support Type --</option>';
    const services = userProfile.isAdmin ? adminManagedServices : userAuthorizedServices;
    services.forEach(service => {
        // Exclude travel-only services from being primary log types, unless it's the only option
        if (service.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM || services.length === 1) {
            const option = document.createElement('option');
            option.value = service.id;
            option.textContent = `${service.description} (${service.code || 'No Code'})`;
            logShiftSupportTypeSelectElement.appendChild(option);
        }
    });
    openModal('logShiftModal');
}

function calculateLoggedKm() {
    if (!logShiftStartKmInputElement || !logShiftEndKmInputElement || !logShiftCalculatedKmElement) return;
    const startKm = parseFloat(logShiftStartKmInputElement.value) || 0;
    const endKm = parseFloat(logShiftEndKmInputElement.value) || 0;
    if (endKm > startKm) {
        logShiftCalculatedKmElement.textContent = `${(endKm - startKm).toFixed(1)} Km`;
    } else {
        logShiftCalculatedKmElement.textContent = '0.0 Km';
    }
}
if (logShiftStartKmInputElement) logShiftStartKmInputElement.addEventListener('input', calculateLoggedKm);
if (logShiftEndKmInputElement) logShiftEndKmInputElement.addEventListener('input', calculateLoggedKm);
if (logShiftClaimTravelToggleElement && logShiftKmFieldsContainerElement) {
    logShiftClaimTravelToggleElement.addEventListener('change', () => {
        logShiftKmFieldsContainerElement.classList.toggle('hide', !logShiftClaimTravelToggleElement.checked);
        if (!logShiftClaimTravelToggleElement.checked) { // Clear KM if unchecked
            if(logShiftStartKmInputElement) logShiftStartKmInputElement.value = '';
            if(logShiftEndKmInputElement) logShiftEndKmInputElement.value = '';
            calculateLoggedKm();
        }
    });
}


async function saveShiftFromModalToInvoice() {
    if (!logShiftDateInputElement || !logShiftSupportTypeSelectElement || !logShiftStartTimeInputElement || !logShiftEndTimeInputElement) {
        showMessage("Error", "Required form elements for logging shift are missing.", "error");
        return;
    }

    const serviceId = logShiftSupportTypeSelectElement.value;
    const serviceDetails = (userProfile.isAdmin ? adminManagedServices : userAuthorizedServices).find(s => s.id === serviceId);

    if (!serviceDetails) {
        showMessage("Validation Error", "Please select a valid support type.", "warning");
        return;
    }

    const shiftData = {
        id: generateUniqueId('item_'), // For invoice item
        date: logShiftDateInputElement.value,
        serviceId: serviceId,
        description: serviceDetails.description,
        serviceCode: serviceDetails.code,
        startTime: logShiftStartTimeInputElement.dataset.value24,
        endTime: logShiftEndTimeInputElement.dataset.value24,
        isTravel: logShiftClaimTravelToggleElement.checked,
        travelKm: 0,
        travelServiceId: serviceDetails.travelCodeId || null // For associating cost later
    };

    if (!shiftData.date || !shiftData.startTime || !shiftData.endTime) {
        showMessage("Validation Error", "Date, start time, and end time are required.", "warning");
        return;
    }
    if (timeToMinutes(shiftData.endTime) <= timeToMinutes(shiftData.startTime)) {
        showMessage("Validation Error", "End time must be after start time.", "warning");
        return;
    }

    shiftData.hours = calculateHours(shiftData.startTime, shiftData.endTime);
    shiftData.rateType = determineRateType(shiftData.date, shiftData.startTime);

    if (serviceDetails.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM || serviceDetails.categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
        shiftData.rate = parseFloat(serviceDetails.rates?.flat || 0);
        shiftData.rateType = "flat";
    } else if (serviceDetails.rates && serviceDetails.rates[shiftData.rateType]) {
        shiftData.rate = parseFloat(serviceDetails.rates[shiftData.rateType] || 0);
    } else if (serviceDetails.rates?.weekday) {
        shiftData.rate = parseFloat(serviceDetails.rates.weekday || 0);
        shiftData.rateType = "weekday";
    } else {
        shiftData.rate = 0;
    }
    
    let travelCost = 0;
    if (shiftData.isTravel) {
        const startKm = parseFloat(logShiftStartKmInputElement.value) || 0;
        const endKm = parseFloat(logShiftEndKmInputElement.value) || 0;
        if (endKm > startKm) {
            shiftData.travelKm = parseFloat((endKm - startKm).toFixed(1));
            if (shiftData.travelServiceId) {
                const travelService = adminManagedServices.find(s => s.id === shiftData.travelServiceId);
                if (travelService && travelService.rates?.flat) {
                    travelCost = shiftData.travelKm * parseFloat(travelService.rates.flat);
                } else {
                     showMessage("Warning", "Travel service rate not found for associated travel code. Travel cost will be 0.", "warning");
                }
            } else {
                showMessage("Warning", "No travel service code associated with the selected support type. Travel cost will be 0.", "warning");
            }
        } else if (startKm > 0 || endKm > 0) { // Only warn if KMs were entered but invalid
            showMessage("Validation Error", "End odometer must be greater than start odometer for travel.", "warning");
            return;
        }
    }
    
    shiftData.total = (shiftData.hours * shiftData.rate) + travelCost;


    // Navigate to invoice section if not already there
    if (!$("section#invoice.active")) {
        navigateToSection("invoice");
    }
    // Add to currentInvoiceData and UI
    currentInvoiceData.items.push(shiftData);
    addInvoiceRowToTable(shiftData); // This will also call updateInvoiceTotals
    
    showMessage("Shift Added", "The shift has been added to the current invoice draft.", "success");
    closeModal('logShiftModal');
    // Optionally, save draft immediately
    // await saveInvoiceDraft();
}


// User Setup Wizard
function openUserSetupWizard() {
    if (!userSetupWizardModalElement || !userProfile) return;
    currentUserWizardStep = 1;
    navigateWizard('user', 1);

    // Populate with existing profile data if available (for editing)
    if(wizardNameInputElement) wizardNameInputElement.value = userProfile.name || '';
    if(wizardAbnInputElement) wizardAbnInputElement.value = userProfile.abn || '';
    if(wizardGstCheckboxElement) wizardGstCheckboxElement.checked = userProfile.gstRegistered || false;
    if(wizardBsbInputElement) wizardBsbInputElement.value = userProfile.bsb || '';
    if(wizardAccInputElement) wizardAccInputElement.value = userProfile.acc || '';
    wizardFileUploads = []; // Clear previous wizard uploads
    if(wizardFilesListElement) wizardFilesListElement.innerHTML = ''; // Clear file list display

    openModal('wiz');
}

// Admin Setup Wizard
function openAdminSetupWizard() {
    if (!adminSetupWizardModalElement || !globalSettings) return;
    currentAdminWizardStep = 1;
    navigateWizard('admin', 1);
    // Populate with existing global settings
    if (adminWizardOrgNameInputElement) adminWizardOrgNameInputElement.value = globalSettings.organizationName || '';
    // ... and so on for all admin wizard fields
    openModal('adminSetupWizard');
}

function navigateWizard(type, step) {
    const wizardModal = type === 'user' ? userSetupWizardModalElement : adminSetupWizardModalElement;
    const stepElements = type === 'user' ? userWizardStepElements : adminWizardStepElements;
    const indicatorElements = type === 'user' ? userWizardIndicatorElements : adminWizardIndicatorElements;

    if (!wizardModal || !stepElements || !indicatorElements) return;

    stepElements.forEach(el => el.classList.add('hide'));
    stepElements[step - 1]?.classList.remove('hide');

    indicatorElements.forEach((el, index) => {
        el.classList.remove('active', 'completed');
        if (index < step -1) el.classList.add('completed');
        if (index === step -1) el.classList.add('active');
    });

    if (type === 'user') currentUserWizardStep = step;
    else currentAdminWizardStep = step;

    // Specific logic for admin wizard step 2 title/fields based on portal type
    if (type === 'admin' && step === 2) {
        const portalType = adminWizardPortalTypeRadioElements.find(r => r.checked)?.value || 'organization';
        const step2Title = wizardModal.querySelector('#adminWizStep2Title');
        const orgFields = wizardModal.querySelector('#adminWizOrgFields');
        const userFields = wizardModal.querySelector('#adminWizUserFields'); // For participant type

        if (portalType === 'organization') {
            if(step2Title) step2Title.textContent = "Step 2: Organization Details";
            if(orgFields) orgFields.classList.remove('hide');
            if(userFields) userFields.classList.add('hide');
        } else { // participant
            if(step2Title) step2Title.textContent = "Step 2: Your Details (as Participant)";
            if(orgFields) orgFields.classList.add('hide');
            if(userFields) userFields.classList.remove('hide');
            if(adminWizardUserNameInputElement && userProfile) adminWizardUserNameInputElement.value = userProfile.name || currentUserEmail.split('@')[0];
        }
    }
}

function wizardNext(type) {
    // Add validation for current step before proceeding if needed
    if (type === 'user') {
        if (currentUserWizardStep < userWizardStepElements.length) {
            // Example validation for step 1 (user wizard)
            if (currentUserWizardStep === 1) {
                if (!wizardNameInputElement.value.trim()) {
                    showMessage("Missing Info", "Please enter your full name.", "warning"); return;
                }
            }
            navigateWizard('user', currentUserWizardStep + 1);
        }
    } else { // admin
        if (currentAdminWizardStep < adminWizardStepElements.length) {
             // Example validation for admin step 1
            if (currentAdminWizardStep === 1) {
                const portalTypeSelected = Array.from(adminWizardPortalTypeRadioElements).some(r => r.checked);
                if (!portalTypeSelected) {
                    showMessage("Missing Info", "Please select a portal type.", "warning"); return;
                }
            }
            navigateWizard('admin', currentAdminWizardStep + 1);
        }
    }
}

function wizardPrev(type) {
    if (type === 'user') {
        if (currentUserWizardStep > 1) navigateWizard('user', currentUserWizardStep - 1);
    } else { // admin
        if (currentAdminWizardStep > 1) navigateWizard('admin', currentAdminWizardStep - 1);
    }
}

async function finishUserWizard() {
    // Collect all data from wizard inputs
    const profileUpdates = {
        name: wizardNameInputElement?.value.trim(),
        abn: wizardAbnInputElement?.value.trim(),
        gstRegistered: wizardGstCheckboxElement?.checked,
        bsb: wizardBsbInputElement?.value.trim(),
        acc: wizardAccInputElement?.value.trim(),
        // profileSetupComplete will be set to true by saveProfileDetails
    };

    // Validate final step if needed
    if (!profileUpdates.name) { // Basic validation
        showMessage("Missing Name", "Your name is required to finish setup.", "warning");
        navigateWizard('user', 1); // Go back to name step
        return;
    }

    showLoading("Finalizing setup...");
    const profileSaved = await saveProfileDetails(profileUpdates, true); // true for isWizardFinish

    if (profileSaved && wizardFileUploads.length > 0) {
        // Simulate file input for uploadProfileDocuments
        // This is a bit of a hack. A better way would be to pass File objects directly.
        // For now, let's assume uploadProfileDocuments can handle an array of File objects if modified,
        // or we trigger it differently.
        // For simplicity, let's directly call a modified upload function for wizard files.
        await uploadWizardProfileDocuments(wizardFileUploads);
    }

    if (profileSaved) {
        closeModal('wiz');
        showMessage("Setup Complete!", "Your profile setup is complete.", "success");
        // Check if initial invoice number needs to be set
        if (!userProfile.nextInvoiceNumber) {
            openModal('setInitialInvoiceModal');
            if(initialInvoiceNumberInputElement) initialInvoiceNumberInputElement.value = "1001";
        }
    }
    hideLoading(); // Ensure loading is hidden
    wizardFileUploads = []; // Clear wizard files
}
// Helper for wizard file uploads
async function uploadWizardProfileDocuments(filesToUpload) {
    if (!filesToUpload || filesToUpload.length === 0) return;
    if (!currentUserId || !fbStorage || !fsDb) return;

    showLoading(`Uploading ${filesToUpload.length} document(s) from setup...`);
    const uploadPromises = filesToUpload.map(async (file) => { /* ... same as uploadProfileDocuments ... */
        const filePath = `artifacts/${appId}/users/${currentUserId}/profileDocuments/${Date.now()}_${file.name}`;
        const fileRef = ref(fbStorage, filePath);
        try {
            const snapshot = await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            return { name: file.name, url: downloadURL, path: filePath, uploadedAt: serverTimestamp() };
        } catch (e) { console.error(`Wizard Upload Error ${file.name}:`, e); throw e; }
    });
    try {
        const uploadedFileObjects = await Promise.all(uploadPromises);
        if (!userProfile.files) userProfile.files = [];
        userProfile.files.push(...uploadedFileObjects);
        const profileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        await updateDoc(profileDocRef, { files: arrayUnion(...uploadedFileObjects) });
        renderProfileFilesList(); // Refresh if profile section is visible
        console.log("Wizard documents uploaded.");
    } catch (e) { showMessage("Wizard Upload Failed", "Could not upload documents from setup.", "error");}
    // hideLoading is handled by finishUserWizard
}


async function finishAdminWizard() {
    const portalType = Array.from(adminWizardPortalTypeRadioElements).find(r => r.checked)?.value;
    const updates = {
        portalType: portalType,
        organizationName: adminWizardOrgNameInputElement?.value.trim(),
        organizationAbn: adminWizardOrgAbnInputElement?.value.trim(),
        organizationContactEmail: adminWizardOrgContactEmailInputElement?.value.trim(),
        organizationContactPhone: adminWizardOrgContactPhoneInputElement?.value.trim(),
        // If participant type, admin's name might be used for participant if fields are shared
        defaultParticipantName: adminWizardParticipantNameInputElement?.value.trim(),
        defaultParticipantNdisNo: adminWizardParticipantNdisNoInputElement?.value.trim(),
        defaultPlanManagerName: adminWizardPlanManagerNameInputElement?.value.trim(),
        defaultPlanManagerEmail: adminWizardPlanManagerEmailInputElement?.value.trim(),
        defaultPlanManagerPhone: adminWizardPlanManagerPhoneInputElement?.value.trim(),
        defaultPlanEndDate: adminWizardPlanEndDateInputElement?.value,
        setupComplete: true, // Mark setup as complete
        adminEmail: currentUserEmail // Ensure current admin's email is set as the portal admin
    };

    if (portalType === 'participant') { // If portal is for a self-managed participant
        updates.organizationName = updates.defaultParticipantName; // Org name becomes participant name
        // Clear other org fields or set them appropriately
        updates.organizationAbn = updates.defaultParticipantNdisNo; // ABN might be NDIS number
        updates.organizationContactEmail = currentUserEmail; // Admin is the contact
    }


    globalSettings = { ...globalSettings, ...updates };
    const success = await saveGlobalSettingsToFirestore();
    if (success) {
        closeModal('adminSetupWizard');
        showMessage("Portal Setup Complete!", "The portal has been configured.", "success");
        renderAdminGlobalSettingsTab(); // Refresh the display
        // Also update admin's own profile if their name was part of the wizard (for participant type)
        if (portalType === 'participant' && adminWizardUserNameInputElement?.value.trim() && userProfile.name !== adminWizardUserNameInputElement.value.trim()) {
            await saveProfileDetails({ name: adminWizardUserNameInputElement.value.trim() });
        }
    }
}

// Custom Time Picker
function openCustomTimePicker(inputEl, callbackFn) {
    if (!customTimePickerElement || !inputEl) return;
    activeTimeInput = inputEl;
    timePickerCallback = callbackFn;

    // Reset picker state
    selectedAmPm = null; selectedHour12 = null; selectedMinute = null;
    setTimeButtonElement.disabled = true;
    timePickerBackButtonElement.classList.add('hide');

    // Initial step: AM/PM
    currentTimePickerStep = 'ampm';
    if(currentTimePickerStepLabelElement) currentTimePickerStepLabelElement.textContent = '(AM/PM)';
    $('#timePickerStepAmPm')?.classList.remove('hide');
    $('#timePickerStepHour')?.classList.add('hide');
    $('#timePickerStepMinute')?.classList.add('hide');
    renderTimePickerAmPm();

    // Position and show
    const inputRect = activeTimeInput.getBoundingClientRect();
    customTimePickerElement.style.top = `${inputRect.bottom + window.scrollY + 5}px`;
    customTimePickerElement.style.left = `${inputRect.left + window.scrollX}px`;
    customTimePickerElement.classList.remove('hide');
}

function renderTimePickerAmPm() {
    if (!timePickerAmPmButtonsContainerElement) return;
    timePickerAmPmButtonsContainerElement.innerHTML = '';
    ['AM', 'PM'].forEach(val => {
        const btn = document.createElement('button');
        btn.textContent = val;
        btn.onclick = () => { selectedAmPm = val; navigateTimePicker('hour'); };
        timePickerAmPmButtonsContainerElement.appendChild(btn);
    });
}
function renderTimePickerHours() {
    if (!timePickerHoursContainerElement) return;
    timePickerHoursContainerElement.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.onclick = () => { selectedHour12 = i; navigateTimePicker('minute'); };
        timePickerHoursContainerElement.appendChild(btn);
    }
}
function renderTimePickerMinutes() {
     if (!timePickerMinutesContainerElement) return;
    timePickerMinutesContainerElement.innerHTML = '';
    ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].forEach(val => {
        const btn = document.createElement('button');
        btn.textContent = val;
        btn.onclick = () => {
            selectedMinute = parseInt(val);
            // Highlight selected minute
            timePickerMinutesContainerElement.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            if(setTimeButtonElement) setTimeButtonElement.disabled = false;
        };
        timePickerMinutesContainerElement.appendChild(btn);
    });
}

function navigateTimePicker(nextStep) {
    currentTimePickerStep = nextStep;
    $('#timePickerStepAmPm')?.classList.add('hide');
    $('#timePickerStepHour')?.classList.add('hide');
    $('#timePickerStepMinute')?.classList.add('hide');
    if(setTimeButtonElement) setTimeButtonElement.disabled = true; // Disable until minute is chosen

    if (nextStep === 'hour') {
        if(currentTimePickerStepLabelElement) currentTimePickerStepLabelElement.textContent = `(${selectedAmPm} - Hour)`;
        $('#timePickerStepHour')?.classList.remove('hide');
        if(timePickerBackButtonElement) timePickerBackButtonElement.classList.remove('hide');
        renderTimePickerHours();
    } else if (nextStep === 'minute') {
        if(currentTimePickerStepLabelElement) currentTimePickerStepLabelElement.textContent = `(${selectedAmPm} - ${selectedHour12}h - Minute)`;
        $('#timePickerStepMinute')?.classList.remove('hide');
        if(timePickerBackButtonElement) timePickerBackButtonElement.classList.remove('hide');
        renderTimePickerMinutes();
    } else { // back to ampm or initial
        if(currentTimePickerStepLabelElement) currentTimePickerStepLabelElement.textContent = '(AM/PM)';
        $('#timePickerStepAmPm')?.classList.remove('hide');
        if(timePickerBackButtonElement) timePickerBackButtonElement.classList.add('hide');
    }
}

function handleSetTimePickerTime() {
    if (selectedAmPm && selectedHour12 != null && selectedMinute != null && activeTimeInput) {
        let hour24 = selectedHour12;
        if (selectedAmPm === 'PM' && selectedHour12 < 12) hour24 += 12;
        if (selectedAmPm === 'AM' && selectedHour12 === 12) hour24 = 0; // Midnight case

        const time24 = `${String(hour24).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
        activeTimeInput.value = formatTime12Hour(time24); // Display 12-hour format
        activeTimeInput.dataset.value24 = time24; // Store 24-hour format

        closeModal('customTimePicker');
        if (timePickerCallback) timePickerCallback();
    } else {
        showMessage("Incomplete Time", "Please select AM/PM, hour, and minute.", "warning");
    }
}
if (timePickerBackButtonElement) {
    timePickerBackButtonElement.addEventListener('click', () => {
        if (currentTimePickerStep === 'minute') navigateTimePicker('hour');
        else if (currentTimePickerStep === 'hour') navigateTimePicker('ampm');
    });
}


/* ========== Event Listeners Setup ========== */
function setupEventListeners() {
    // Auth
    loginButtonElement?.addEventListener('click', modalLogin);
    registerButtonElement?.addEventListener('click', modalRegister);
    logoutButtonElement?.addEventListener('click', portalSignOut);
    authPasswordInputElement?.addEventListener('keypress', e => { if (e.key === 'Enter') modalLogin(); });

    // Navigation
    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => a.addEventListener('click', e => {
        e.preventDefault();
        const sectionId = a.hash.substring(1);
        navigateToSection(sectionId);
    }));

    // Profile
    editProfileButtonElement?.addEventListener('click', () => openUserSetupWizard()); // Re-use wizard for editing
    uploadProfileDocumentsButtonElement?.addEventListener('click', uploadProfileDocuments);
    // Delete file buttons are added dynamically in renderProfileFilesList

    // Invoice
    addInvoiceRowButtonElement?.addEventListener('click', addInvRowUserAction);
    saveDraftButtonElement?.addEventListener('click', saveInvoiceDraft);
    generateInvoicePdfButtonElement?.addEventListener('click', generateInvoicePdf);
    saveInitialInvoiceNumberButtonElement?.addEventListener('click', saveInitialInvoiceNumber);
    if (invoiceDateInputElement && invoiceWeekLabelElement) {
        invoiceDateInputElement.addEventListener('change', () => {
            invoiceWeekLabelElement.textContent = getWeekNumber(new Date(invoiceDateInputElement.value));
        });
    }

    // Agreement
    signAgreementButtonElement?.addEventListener('click', () => openSignatureModal('worker'));
    participantSignButtonElement?.addEventListener('click', () => openSignatureModal('participant'));
    downloadAgreementPdfButtonElement?.addEventListener('click', generateAgreementPdf);
    saveSignatureButtonElement?.addEventListener('click', saveSignature);
    clearSignatureButtonElement?.addEventListener('click', clearSignaturePad);
    closeSignatureModalButtonElement?.addEventListener('click', () => closeModal('sigModal'));
    loadServiceAgreementForSelectedWorkerButtonElement?.addEventListener('click', () => {
        if (adminSelectWorkerForAgreementElement) {
            const selectedEmail = adminSelectWorkerForAgreementElement.value;
            if (selectedEmail) {
                loadAndRenderServiceAgreement(selectedEmail);
            } else {
                showMessage("No Worker Selected", "Please select a worker from the dropdown.", "info");
            }
        }
    });

    // Admin Tabs
    adminNavTabButtons.forEach(btn => btn.addEventListener('click', () => switchAdminTab(btn.dataset.target)));

    // Admin Global Settings
    saveAdminPortalSettingsButtonElement?.addEventListener('click', saveAdminPortalSettings);
    resetGlobalSettingsToDefaultsButtonElement?.addEventListener('click', window.confirmResetGlobalSettings);
    copyInviteLinkButtonElement?.addEventListener('click', () => {
        if (inviteLinkCodeElement && navigator.clipboard) {
            navigator.clipboard.writeText(inviteLinkCodeElement.textContent)
                .then(() => showMessage("Copied!", "Invite link copied to clipboard.", "success"))
                .catch(err => showMessage("Copy Failed", "Could not copy link.", "error"));
        }
    });

    // Admin Service Management
    saveAdminServiceButtonElement?.addEventListener('click', saveAdminServiceToFirestore);
    clearAdminServiceFormButtonElement?.addEventListener('click', clearAdminServiceForm);
    selectTravelCodeButtonElement?.addEventListener('click', openTravelCodeSelectionModal);
    adminServiceCategoryTypeSelectElement?.addEventListener('change', renderAdminServiceRateFields);
    closeTravelCodeSelectionModalButtonElement?.addEventListener('click', () => closeModal('travelCodeSelectionModal'));


    // Admin Agreement Customization
    adminAddAgreementClauseButtonElement?.addEventListener('click', addAdminAgreementClauseEditor);
    saveAdminAgreementCustomizationsButtonElement?.addEventListener('click', saveAdminAgreementCustomizationsToFirestore);
    if (adminAgreementOverallTitleInputElement) { // Live preview for title
        adminAgreementOverallTitleInputElement.addEventListener('input', updateAdminAgreementPreview);
    }


    // Admin Worker Management
    saveWorkerAuthorizationsButtonElement?.addEventListener('click', saveWorkerAuthorizationsToFirestore);

    // Shift Request Modal
    requestShiftButtonElement?.addEventListener('click', openRequestShiftModal);
    closeRequestModalButtonElement?.addEventListener('click', () => closeModal('rqModal'));
    saveRequestButtonElement?.addEventListener('click', saveShiftRequest);
    $$('.custom-time-input').forEach(input => { // Attach to all custom time inputs
        input.addEventListener('click', () => openCustomTimePicker(input, () => {
            // Optional: Callback after time is set, e.g., if it needs to trigger another update
            // For invoice rows, this is handled by updateInvoiceItemFromRow
            // For modals like shift request, might need specific logic if values are interdependent
            if (input.closest('#rqModal') || input.closest('#logShiftModal')) {
                // If in request or log shift modal, could re-validate start/end times here
            }
        }));
    });


    // Log Shift Modal
    logTodayShiftButtonElement?.addEventListener('click', openLogShiftModal);
    closeLogShiftModalButtonElement?.addEventListener('click', () => closeModal('logShiftModal'));
    saveShiftToInvoiceButtonElement?.addEventListener('click', saveShiftFromModalToInvoice);


    // Message Modal
    closeMessageModalButtonElement?.addEventListener('click', () => closeModal('messageModal'));

    // User Wizard
    wizardNextButton1Element?.addEventListener('click', () => wizardNext('user'));
    wizardNextButton2Element?.addEventListener('click', () => wizardNext('user'));
    wizardNextButton3Element?.addEventListener('click', () => wizardNext('user'));
    wizardPrevButton2Element?.addEventListener('click', () => wizardPrev('user'));
    wizardPrevButton3Element?.addEventListener('click', () => wizardPrev('user'));
    wizardPrevButton4Element?.addEventListener('click', () => wizardPrev('user'));
    wizardFinishButtonElement?.addEventListener('click', finishUserWizard);
    wizardFilesInputElement?.addEventListener('change', (e) => {
        wizardFileUploads = Array.from(e.target.files);
        if (wizardFilesListElement) {
            wizardFilesListElement.innerHTML = wizardFileUploads.map(f => `<div><i class="fas fa-file"></i> ${f.name} (${(f.size/1024).toFixed(1)}KB)</div>`).join('');
        }
    });


    // Admin Wizard
    adminWizardNextButton1Element?.addEventListener('click', () => wizardNext('admin'));
    adminWizardNextButton2Element?.addEventListener('click', () => wizardNext('admin'));
    adminWizardPrevButton2Element?.addEventListener('click', () => wizardPrev('admin'));
    adminWizardPrevButton3Element?.addEventListener('click', () => wizardPrev('admin'));
    adminWizardFinishButtonElement?.addEventListener('click', finishAdminWizard);
    adminWizardPortalTypeRadioElements.forEach(radio => { // Update admin wizard step 2 based on type selection
        radio.addEventListener('change', () => { if (currentAdminWizardStep === 1 || currentAdminWizardStep === 2) navigateWizard('admin', 2); });
    });

    // Custom Time Picker
    setTimeButtonElement?.addEventListener('click', handleSetTimePickerTime);
    cancelTimeButtonElement?.addEventListener('click', () => closeModal('customTimePicker'));


    // Global listener for hash changes (e.g. browser back/forward)
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash || '#home';
        navigateToSection(hash.substring(1));
    });
}

/* ========== App Initialization ========== */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed. App Version 1.1.0");
    showLoading("Initializing Portal...");
    await initializeFirebaseApp(); // This now calls setupAuthListener internally
    setupEventListeners();

    // Initial navigation based on hash or default to home
    // onAuthStateChanged will handle the primary navigation logic after auth is resolved.
    // A simple initial hash check can be done, but might be preempted by auth.
    const initialHash = window.location.hash.substring(1) || 'home';
    if (!currentUserId) { // If auth hasn't kicked in yet, briefly show the target section (usually home)
        navigateToSection(initialHash);
    }
    // The main hideLoading will be in onAuthStateChanged after all initial auth and data loading.
    // For now, if initializeFirebaseApp failed, hide loading.
    if (!isFirebaseInitialized) {
        hideLoading();
    }
});

