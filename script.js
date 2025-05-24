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
        // The path 'artifacts/{appId}/public/logs/errors' is 5 segments, which is correct for a collection
        // where addDoc will create a new document with an auto-generated ID.
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
function showMessage(title, text, type = 'info') {
    const iconClass = type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
    if (messageModalTitleElement) messageModalTitleElement.innerHTML = `<i class="fas ${iconClass}"></i> ${title}`;
    if (messageModalTextElement) messageModalTextElement.innerHTML = text;
    if (messageModalElement) messageModalElement.style.display = "flex";
}
function openModal(modalId) { const modal = $(`#${modalId}`); if (modal) modal.style.display = 'flex'; }
function closeModal(modalId) { const modal = $(`#${modalId}`); if (modal) modal.style.display = 'none'; }

// Added function to update portal title
function updatePortalTitle() {
    const title = globalSettings.portalTitle || "NDIS Support Portal";
    if (portalTitleDisplayElement) {
        portalTitleDisplayElement.textContent = title;
    }
    document.title = title; // Optional: Update browser tab title
    console.log(`[UI] Portal title updated to: ${title}`);
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
function generateUniqueId() { return Date.now().toString(36) + Math.random().toString(36).substring(2); }
function getWeekNumber(d) { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); const yS = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil((((d - yS) / 86400000) + 1) / 7); }

/* ========== Firebase Initialization & Auth ========== */
async function initializeFirebaseApp() {
    console.log("[FirebaseInit] Initializing...");
    // Ensure firebaseConfigForApp is globally available or passed correctly
    const config = typeof firebaseConfigForApp !== 'undefined' ? firebaseConfigForApp : (typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null);

    if (!config || !config.apiKey || config.apiKey.startsWith("YOUR_")) {
        showAuthStatusMessage("System Error: Portal configuration invalid. Missing Firebase config."); hideLoading();
        logErrorToFirestore("initializeFirebaseApp", "Firebase config missing or invalid", { apiKey: config ? config.apiKey : 'undefined' });
        return;
    }
    try {
        fbApp = initializeApp(config, appId); // Use appId for named app instance
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
                    console.log("[AuthListener] User authenticated:", currentUserId, currentUserEmail);
                    if(userIdDisplayElement) userIdDisplayElement.textContent = currentUserEmail || currentUserId;
                    if(logoutButtonElement) logoutButtonElement.classList.remove('hide');
                    if(authScreenElement) authScreenElement.style.display = "none";
                    if(portalAppElement) portalAppElement.style.display = "flex";

                    await loadGlobalSettingsFromFirestore(); // Load settings first
                    const profileData = await loadUserProfileFromFirestore(currentUserId);
                    let signedOut = false; // Flag to track if user flow results in sign out

                    if (profileData) {
                        signedOut = await handleExistingUserProfile(profileData);
                    } else if (currentUserEmail && currentUserEmail.toLowerCase() === (globalSettings.adminEmail || "admin@portal.com").toLowerCase()) { // Check against configured admin email
                        signedOut = await handleNewAdminProfile();
                    } else if (currentUserId) {
                        signedOut = await handleNewRegularUserProfile();
                    } else {
                        // This case should ideally not be reached if 'user' is truthy
                        console.warn("[AuthListener] User object present but no identifiable path. Signing out.");
                        await fbSignOut(fbAuth);
                        signedOut = true;
                    }

                    if (signedOut) {
                        console.log("[AuthListener] User flow led to sign out. Navigating to home.");
                        // State will be handled by the 'else' block of onAuthStateChanged
                    }
                } else {
                    console.log("[AuthListener] User signed out or no user.");
                    currentUserId = null; currentUserEmail = null; userProfile = {}; globalSettings = getDefaultGlobalSettings(); // Reset global settings on sign out
                    if(userIdDisplayElement) userIdDisplayElement.textContent = "Not Logged In";
                    if(logoutButtonElement) logoutButtonElement.classList.add('hide');
                    if(authScreenElement) authScreenElement.style.display = "flex";
                    if(portalAppElement) portalAppElement.style.display = "none";
                    updateNavigation(false);
                    navigateToSection("home"); // Navigate to home, which will call renderUserHomePage if not admin
                    updatePortalTitle(); // Update title to default
                }
            } catch (error) {
                console.error("[AuthListener] Error:", error);
                logErrorToFirestore("onAuthStateChanged", error.message, error);
                if (fbAuth) await fbSignOut(fbAuth).catch(e => console.error("Sign out error during auth error handling:", e));
            } finally {
                hideLoading();
                if (!initialAuthComplete) {
                    initialAuthComplete = true;
                    resolve();
                }
            }
        });

        // Handle custom token sign-in if available
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            console.log("[AuthListener] Attempting sign-in with custom token.");
            signInWithCustomToken(fbAuth, __initial_auth_token)
                .catch(e => {
                    console.error("Custom token sign-in error:", e);
                    logErrorToFirestore("signInWithCustomToken", e.message, e);
                    // Potentially trigger anonymous sign-in or show error
                });
        } else {
            console.log("[AuthListener] No __initial_auth_token found. Waiting for standard auth state change or login action.");
        }
    });
}


async function handleExistingUserProfile(data) {
    userProfile = data;
    console.log(`[Auth] Existing profile loaded. Approved: ${userProfile.approved}, Admin: ${userProfile.isAdmin}, Setup Complete: ${userProfile.profileSetupComplete}`);

    if (!userProfile.isAdmin && globalSettings.portalType === 'organization' && !userProfile.approved) {
        showMessage("Approval Required", "Your account is pending approval from the administrator. You will be logged out.", "warning");
        await fbSignOut(fbAuth);
        return true; // Indicates sign out occurred
    }

    if (userProfile.isAdmin) {
        await loadAllDataForAdmin();
        enterPortal(true);
        if (!globalSettings.setupComplete) {
            openAdminSetupWizard();
        }
    } else {
        await loadAllDataForUser();
        enterPortal(false);
        if (!userProfile.profileSetupComplete && globalSettings.portalType !== 'individual_participant') { // Only show wizard if not participant direct
             openUserSetupWizard();
        }
    }
    return false; // Indicates no sign out occurred
}

async function handleNewAdminProfile() {
    console.log("[Auth] New admin login detected for:", currentUserEmail);
    userProfile = {
        isAdmin: true,
        name: "Administrator",
        email: currentUserEmail,
        uid: currentUserId,
        approved: true, // Admins are auto-approved
        createdAt: serverTimestamp(),
        profileSetupComplete: true, // Admins might have a different setup or skip user wizard
        nextInvoiceNumber: 1001 // Default for new admin
    };
    try {
        await setDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), userProfile);
        console.log("[Auth] New admin profile created in Firestore.");
        await loadAllDataForAdmin();
        enterPortal(true);
        // Check if global settings setup is complete, if not, trigger admin setup wizard
        if (!globalSettings.setupComplete) {
            console.log("[Auth] Global settings not complete, opening admin setup wizard.");
            openAdminSetupWizard();
        }
    } catch (error) {
        console.error("[Auth] Error creating new admin profile:", error);
        logErrorToFirestore("handleNewAdminProfile", error.message, error);
        showMessage("Setup Error", "Could not initialize admin account. Please try again or contact support.", "error");
        await fbSignOut(fbAuth);
        return true; // Indicates sign out occurred
    }
    return false; // Indicates no sign out occurred
}

async function handleNewRegularUserProfile() {
    console.log("[Auth] New regular user detected:", currentUserEmail);
    const isOrgPortal = globalSettings.portalType === 'organization';
    userProfile = {
        name: currentUserEmail.split('@')[0], // Default name from email
        email: currentUserEmail,
        uid: currentUserId,
        isAdmin: false,
        approved: !isOrgPortal, // Auto-approve if not an organization portal, otherwise requires admin approval
        profileSetupComplete: false, // New users need to complete setup
        nextInvoiceNumber: 1001, // Default for new user
        createdAt: serverTimestamp(),
        authorizedServices: [] // Initialize for organization portals
    };

    try {
        await setDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), userProfile);
        console.log("[Auth] New regular user profile created in Firestore.");

        if (isOrgPortal && !userProfile.approved) {
            showMessage("Registration Complete", "Your account has been created and is awaiting approval from the administrator. You will be logged out.", "info");
            await fbSignOut(fbAuth);
            return true; // Indicates sign out occurred
        }

        await loadAllDataForUser();
        enterPortal(false);
        // Trigger user setup wizard if their profile setup is not complete
        if (!userProfile.profileSetupComplete && globalSettings.portalType !== 'individual_participant') {
            console.log("[Auth] User profile setup not complete, opening user setup wizard.");
            openUserSetupWizard();
        }
    } catch (error) {
        console.error("[Auth] Error creating new regular user profile:", error);
        logErrorToFirestore("handleNewRegularUserProfile", error.message, error);
        showMessage("Registration Error", "Could not complete your registration. Please try again or contact support.", "error");
        await fbSignOut(fbAuth);
        return true; // Indicates sign out occurred
    }
    return false; // Indicates no sign out occurred
}


/* ========== Data Loading & Saving ========== */
async function loadUserProfileFromFirestore(uid) {
    if (!fsDb || !uid) {
        console.error("Profile Load Error: Firestore DB not initialized or UID missing.");
        return null;
    }
    try {
        const userProfileRef = doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details");
        const snap = await getDoc(userProfileRef);
        if (snap.exists()) {
            console.log("[DataLoad] User profile loaded from Firestore for UID:", uid);
            return snap.data();
        } else {
            console.log("[DataLoad] No user profile found in Firestore for UID:", uid);
            return null;
        }
    }
    catch (e) {
        console.error("Profile Load Error:", e);
        logErrorToFirestore("loadUserProfileFromFirestore", e.message, e);
        return null;
    }
}

function getDefaultGlobalSettings() {
    return {
        portalTitle: "NDIS Support Portal",
        organizationName: "Your Organization Name",
        organizationAbn: "Your ABN",
        organizationContactEmail: "contact@example.com",
        organizationContactPhone: "000-000-000",
        adminEmail: "admin@portal.com", // Added adminEmail for easier admin identification
        defaultParticipantName: "Participant Name",
        defaultParticipantNdisNo: "000000000",
        defaultPlanManagerName: "Plan Manager Name",
        defaultPlanManagerEmail: "pm@example.com",
        defaultPlanManagerPhone: "111-111-111",
        defaultPlanEndDate: formatDateForInput(new Date(new Date().setFullYear(new Date().getFullYear() + 1))),
        setupComplete: false, // Indicates if the admin setup wizard has been completed
        portalType: "organization", // "organization", "individual_support_worker", "individual_participant"
        agreementTemplate: JSON.parse(JSON.stringify(defaultAgreementCustomData)), // Deep copy
        requireDocumentUploads: true,
        defaultCurrency: "AUD"
    };
}

async function loadGlobalSettingsFromFirestore() {
    if (!fsDb) {
        console.error("Global Settings Load Error: Firestore DB not initialized.");
        globalSettings = getDefaultGlobalSettings();
        updatePortalTitle(); // Update with default title
        return;
    }
    try {
        // Corrected path: collection 'artifacts/{appId}/public', document 'settings'
        const settingsDocRef = doc(fsDb, `artifacts/${appId}/public`, "settings");
        const snap = await getDoc(settingsDocRef);

        if (snap.exists()) {
            globalSettings = { ...getDefaultGlobalSettings(), ...snap.data() };
            console.log("[DataLoad] Global settings loaded from Firestore.");
        }
        else {
            console.log("[DataLoad] No global settings found in Firestore. Using defaults and saving.");
            globalSettings = getDefaultGlobalSettings();
            // Attempt to save the default settings if an admin is effectively logged in or during initial setup
            // This might be better handled by an explicit setup step by an admin.
            // For now, we'll save it if we can (e.g., if this is part of an admin's first login flow)
            // but be mindful of permissions.
            if (userProfile && userProfile.isAdmin) { // Check if an admin is available to save
                 await saveGlobalSettingsToFirestore();
            } else {
                console.warn("[DataLoad] Cannot save default global settings without admin privileges currently.")
            }
        }
    } catch (e) {
        console.error("Global Settings Load Error:", e);
        logErrorToFirestore("loadGlobalSettingsFromFirestore", e.message, e);
        globalSettings = getDefaultGlobalSettings(); // Fallback to defaults on error
    }
    // Ensure agreementCustomData is initialized correctly
    agreementCustomData = globalSettings.agreementTemplate ? JSON.parse(JSON.stringify(globalSettings.agreementTemplate)) : JSON.parse(JSON.stringify(defaultAgreementCustomData));
    updatePortalTitle(); // Update portal title based on loaded/default settings
}

async function saveGlobalSettingsToFirestore() {
    if (!fsDb || !(userProfile && userProfile.isAdmin)) { // Check for admin privileges
        console.error("Global Settings Save Error: Firestore DB not initialized or no admin privileges.");
        logErrorToFirestore("saveGlobalSettingsToFirestore", "Attempted to save global settings without admin privileges or DB not init.", { isAdmin: userProfile ? userProfile.isAdmin : 'unknown' });
        return false;
    }
    // Ensure agreement template is part of the global settings being saved
    globalSettings.agreementTemplate = JSON.parse(JSON.stringify(agreementCustomData)); // Deep copy
    try {
        // Corrected path: collection 'artifacts/{appId}/public', document 'settings'
        const settingsDocRef = doc(fsDb, `artifacts/${appId}/public`, "settings");
        await setDoc(settingsDocRef, globalSettings, { merge: true });
        console.log("[DataSave] Global settings saved to Firestore.");
        updatePortalTitle(); // Reflect any title changes immediately
        return true;
    }
    catch (e) {
        console.error("Global Settings Save Error:", e);
        logErrorToFirestore("saveGlobalSettingsToFirestore", e.message, e);
        return false;
    }
}


async function loadAdminServicesFromFirestore() {
    adminManagedServices = [];
    if (!fsDb) { console.error("Services Load Error: Firestore DB not initialized."); return; }
    try {
        // Path: collection 'artifacts/{appId}/public/services' (5 segments - correct for collection)
        const servicesCollectionRef = collection(fsDb, `artifacts/${appId}/public/services`);
        const querySnapshot = await getDocs(servicesCollectionRef);
        querySnapshot.forEach(d => adminManagedServices.push({ id: d.id, ...d.data() }));
        console.log("[DataLoad] Admin services loaded:", adminManagedServices.length);
    } catch (e) {
        console.error("Services Load Error:", e);
        logErrorToFirestore("loadAdminServicesFromFirestore", e.message, e);
    }
    renderAdminServicesTable();
    populateServiceTypeDropdowns();
}

async function loadAllUsersForAdmin() {
    allUsersCache = {};
    if (!userProfile.isAdmin || !fsDb) {
        console.warn("Cannot load all users: Not admin or Firestore not initialized.");
        return;
    }
    try {
        // Path to users collection: 'artifacts/{appId}/users' (3 segments - correct for collection)
        const usersCollectionRef = collection(fsDb, `artifacts/${appId}/users`);
        const usersSnapshot = await getDocs(usersCollectionRef);
        const profilePromises = [];

        usersSnapshot.forEach(userDoc => {
            const uid = userDoc.id;
            // Path to each user's profile document: 'artifacts/{appId}/users/{uid}/profile/details' (6 segments - correct for document)
            const profileRef = doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details");
            profilePromises.push(getDoc(profileRef).catch(e => {
                console.warn(`Failed to get profile for user ${uid}:`, e); // Log individual failures
                return null; // Return null for failed promises to not break Promise.all
            }));
        });

        const profileSnapshots = await Promise.all(profilePromises);
        profileSnapshots.forEach(profileSnap => {
            if (profileSnap && profileSnap.exists()) { // Check if profileSnap is not null
                const profile = profileSnap.data();
                if (profile.email) {
                    allUsersCache[profile.email] = profile;
                } else if (profile.uid) { // Fallback to UID if no email (should be rare)
                    allUsersCache[profile.uid] = profile;
                }
            }
        });
        console.log("[DataLoad] All user profiles cached for admin:", Object.keys(allUsersCache).length);
    } catch (error) {
        console.error("Error loading all users for admin:", error);
        logErrorToFirestore("loadAllUsersForAdmin", error.message, error);
    }
}


async function loadAllDataForUser() {
    showLoading("Loading your data...");
    // Example: Load user-specific shift requests or other data
    // await loadUserShiftRequests();
    // await loadUserInvoiceDraft();
    // await loadUserAgreementState();
    console.log("[DataLoad] Placeholder for loading all user-specific data.");
    hideLoading();
}
async function loadAllDataForAdmin() {
    showLoading("Loading admin data...");
    await loadAllUsersForAdmin();
    await loadAdminServicesFromFirestore();
    await loadPendingApprovalWorkers();
    await loadApprovedWorkersForAuthManagement();
    renderAdminAgreementCustomizationTab(); // This might also need data loading
    console.log("[DataLoad] All admin data loading sequence complete.");
    hideLoading();
}

/* ========== Portal Entry & Navigation ========== */
function enterPortal(isAdmin) {
    console.log(`Entering portal. User: ${currentUserEmail}, Admin: ${isAdmin}`);
    if(portalAppElement) portalAppElement.style.display = "flex";
    if(authScreenElement) authScreenElement.style.display = "none";

    updateNavigation(isAdmin);
    updateProfileDisplay(); // Update profile display elements if they exist
    updatePortalTitle();    // Ensure portal title is set based on loaded settings

    if (isAdmin) {
        navigateToSection("admin"); // Default to admin dashboard
        renderAdminDashboard();     // Render the specific content for the admin dashboard
    } else {
        navigateToSection("home");  // Default to user home page
        renderUserHomePage();       // Render the specific content for the user home page
        if (!userProfile.nextInvoiceNumber && globalSettings.portalType !== 'individual_participant') { // Only prompt for invoice if not participant
            openModal('setInitialInvoiceModal');
        }
    }
}


function updateNavigation(isAdmin) {
    const linksToShow = ["#home", "#profile", "#invoice", "#agreement"];
    if (isAdmin) {
        linksToShow.push("#admin");
        if(adminTabElement) adminTabElement.classList.remove('hide');
    } else {
        if(adminTabElement) adminTabElement.classList.add('hide');
    }

    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => {
        if (a && a.hash) { // Ensure 'a' and 'a.hash' are defined
            a.classList.toggle('hide', !linksToShow.includes(a.hash));
        }
    });
    console.log("[UI] Navigation updated. Admin status:", isAdmin);
}


function navigateToSection(sectionId) {
    if (!sectionId) {
        console.warn("[Navigate] No sectionId provided, defaulting to 'home'.");
        sectionId = 'home';
    }
    $$("main section.card").forEach(s => s.classList.remove("active"));
    const targetSection = $(`#${sectionId}`);
    if (targetSection) {
        targetSection.classList.add("active");
    } else {
        console.warn(`[Navigate] Target section '#${sectionId}' not found. Defaulting to home.`);
        $(`#home`)?.classList.add("active"); // Fallback to home if target not found
        sectionId = 'home'; // Update sectionId to actual navigated section
    }

    $$("nav a").forEach(a => a.classList.remove("active"));
    $$(`nav a[href="#${sectionId}"]`).forEach(a => a.classList.add("active"));

    const mainContentArea = $("main");
    if(mainContentArea) mainContentArea.scrollTop = 0; // Scroll to top of new section

    // Call render functions for the specific section being navigated to
    // This ensures content is fresh if it depends on dynamic data
    console.log(`[Navigate] Navigating to section: #${sectionId}`);
    switch (sectionId) {
        case "home":
            // renderUserHomePage is called by enterPortal or auth state change for non-admins
            // If admin lands on home (not typical), you might need a renderAdminHomePage or similar
            if (userProfile && !userProfile.isAdmin) renderUserHomePage();
            break;
        case "profile":
            renderProfileSection();
            break;
        case "invoice":
            renderInvoiceSection();
            break;
        case "agreement":
            renderAgreementSection();
            break;
        case "admin":
            if (userProfile && userProfile.isAdmin) renderAdminDashboard();
            else navigateToSection("home"); // Non-admins should not access admin section
            break;
        default:
            console.warn(`[Navigate] No specific render function for section: #${sectionId}`);
            // Optionally navigate to a default/error page or home
            if (!$(`#${sectionId}`)?.classList.contains('active')) { // If navigation failed
                 $(`#home`)?.classList.add("active");
                 $$(`nav a[href="#home"]`).forEach(a => a.classList.add("active"));
            }
    }
}


/* ========== Auth Functions ========== */
async function modalLogin() {
    const email = authEmailInputElement.value.trim();
    const password = authPasswordInputElement.value;
    if (!validateEmail(email) || !password) { showAuthStatusMessage("Invalid email or password format."); return; }

    showLoading("Logging in..."); showAuthStatusMessage("", false);
    try {
        await signInWithEmailAndPassword(fbAuth, email, password);
        // onAuthStateChanged will handle UI updates and navigation
        console.log("[Auth] Login successful for:", email);
    }
    catch (err) {
        console.error("Login Error:", err);
        logErrorToFirestore("modalLogin", err.message, { code: err.code, emailAttempted: email });
        let userMessage = "Login failed. Please check your credentials.";
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            userMessage = "Invalid email or password.";
        } else if (err.code === 'auth/too-many-requests') {
            userMessage = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
        }
        showAuthStatusMessage(userMessage);
    }
    finally { hideLoading(); }
}

async function modalRegister() {
    const email = authEmailInputElement.value.trim();
    const password = authPasswordInputElement.value;
    if (!validateEmail(email)) { showAuthStatusMessage("Please enter a valid email address."); return; }
    if (password.length < 6) { showAuthStatusMessage("Password must be at least 6 characters long."); return; }

    showLoading("Registering..."); showAuthStatusMessage("", false);
    try {
        await createUserWithEmailAndPassword(fbAuth, email, password);
        // onAuthStateChanged will handle the new user, create profile, and navigate.
        console.log("[Auth] Registration successful for:", email);
        // Potentially show a success message before onAuthStateChanged takes over if desired.
        // showAuthStatusMessage("Registration successful! Please wait...", false);
    }
    catch (err) {
        console.error("Register Error:", err);
        logErrorToFirestore("modalRegister", err.message, { code: err.code, emailAttempted: email });
        let userMessage = "Registration failed. Please try again.";
        if (err.code === 'auth/email-already-in-use') {
            userMessage = "This email address is already registered. Please try logging in.";
        } else if (err.code === 'auth/weak-password') {
            userMessage = "The password is too weak. Please choose a stronger password.";
        }
        showAuthStatusMessage(userMessage);
    }
    finally { hideLoading(); }
}

async function portalSignOut() {
    showLoading("Logging out...");
    try {
        await fbSignOut(fbAuth);
        console.log("[Auth] User signed out successfully.");
        // onAuthStateChanged will clear user state and navigate to authScreen/home.
    } catch (e) {
        console.error("Sign Out Error:", e);
        logErrorToFirestore("portalSignOut", e.message, e);
        showMessage("Logout Error", "An error occurred while signing out. Please try again.", "error");
    } finally {
        hideLoading();
    }
}

/* ========== Home Page Functions ========== */
// Added function to render user home page content
function renderUserHomePage() {
    if (!userProfile || !currentUserId || userProfile.isAdmin) {
        // This function is for non-admin users.
        // If an admin somehow lands here, or no user profile, hide the user-specific home content.
        if(homeUserDivElement) homeUserDivElement.style.display = 'none';
        console.log("[Home] renderUserHomePage called but user is admin or profile not loaded. Hiding user home div.");
        return;
    }

    console.log("[Home] Rendering user home page for:", userProfile.name);
    if(homeUserDivElement) homeUserDivElement.style.display = 'block'; // Show the main div for user home

    // Update User Name Display
    if(userNameDisplayElement) {
        userNameDisplayElement.textContent = userProfile.name || 'Valued User';
    }

    // Example: Display a welcome message or quick actions
    // const welcomeMessageElement = $("#userWelcomeMessage"); // Assuming you add such an element
    // if(welcomeMessageElement) welcomeMessageElement.textContent = `Welcome back, ${userProfile.name}!`;

    // Placeholder for loading and displaying user-specific data like shift requests
    // loadUserShiftRequests(); // You would define this function to fetch and render requests
    if(shiftRequestsTableBodyElement) {
        // Example: Clear old requests and show a loading message or "no requests"
        shiftRequestsTableBodyElement.innerHTML = '<tr><td colspan="5">Loading shift requests...</td></tr>';
        // Call a function to actually load and render them, e.g.,
        // displayUserShiftRequests();
    }

    // Ensure buttons are visible if they are part of the user home
    if(requestShiftButtonElement) requestShiftButtonElement.style.display = 'inline-block';
    if(logTodayShiftButtonElement) logTodayShiftButtonElement.style.display = 'inline-block';
}

// Example: function to load and display shift requests (you'd need to implement this)
async function displayUserShiftRequests() {
    if (!shiftRequestsTableBodyElement || !currentUserId) return;
    // showLoading("Loading your shift requests...");
    try {
        // const requests = await fetchUserShiftRequestsFromFirestore(currentUserId); // Implement this fetch function
        const requests = []; // Placeholder
        if (requests.length === 0) {
            shiftRequestsTableBodyElement.innerHTML = '<tr><td colspan="5">You have no pending shift requests.</td></tr>';
        } else {
            shiftRequestsTableBodyElement.innerHTML = ''; // Clear loading/previous
            requests.forEach(req => {
                const row = shiftRequestsTableBodyElement.insertRow();
                row.innerHTML = `
                    <td>${formatDateForDisplay(req.date)}</td>
                    <td>${formatTime12Hour(req.startTime)}</td>
                    <td>${formatTime12Hour(req.endTime)}</td>
                    <td>${req.reason || 'N/A'}</td>
                    <td><span class="status-${(req.status || 'pending').toLowerCase()}">${req.status || 'Pending'}</span></td>
                `;
            });
        }
    } catch (error) {
        console.error("Error displaying shift requests:", error);
        logErrorToFirestore("displayUserShiftRequests", error.message, error);
        shiftRequestsTableBodyElement.innerHTML = '<tr><td colspan="5">Could not load shift requests.</td></tr>';
    } finally {
        // hideLoading();
    }
}


/* ========== Profile Functions ========== */
function renderProfileSection() {
    if (!userProfile || !currentUserId) {
        console.warn("[Profile] Cannot render profile: User profile not loaded or no current user.");
        // Optionally, redirect or show a message
        // navigateToSection('home'); // Or show a placeholder
        if(profileNameElement) profileNameElement.textContent = 'N/A';
        // Clear other fields too
        return;
    }
    console.log("[Profile] Rendering profile section for:", userProfile.name);
    updateProfileDisplay();
}

function updateProfileDisplay() {
    if (!userProfile) return; // Guard clause

    if(profileNameElement) profileNameElement.textContent = userProfile.name || 'N/A';
    if(profileAbnElement) profileAbnElement.textContent = userProfile.abn || 'N/A';
    if(profileGstElement) profileGstElement.textContent = userProfile.gstRegistered ? 'Yes' : 'No';
    if(profileBsbElement) profileBsbElement.textContent = userProfile.bsb || 'N/A';
    if(profileAccElement) profileAccElement.textContent = userProfile.acc || 'N/A';

    renderProfileFilesList(); // This function needs implementation
}
function renderProfileFilesList() {
    if (!profileFilesListElement) return;
    profileFilesListElement.innerHTML = ''; // Clear existing
    const files = userProfile.uploadedFiles || [];
    if (files.length === 0) {
        profileFilesListElement.innerHTML = '<li>No documents uploaded yet.</li>';
        return;
    }
    files.forEach(file => {
        const li = document.createElement('li');
        li.innerHTML = `
            <a href="${file.url}" target="_blank" rel="noopener noreferrer">${file.name}</a>
            (Uploaded: ${formatDateForDisplay(file.uploadedAt)})
            <button class="btn btn-danger btn-sm" onclick="window.confirmDeleteProfileDocument('${file.name}', '${file.path}')">Delete</button>
        `;
        profileFilesListElement.appendChild(li);
    });
}
async function saveProfileDetails(updates) {
    if (!fsDb || !currentUserId || !userProfile) {
        console.error("Save Profile Error: Firestore DB not initialized, no user ID, or profile not loaded.");
        showMessage("Error", "Could not save profile. Please try again.", "error");
        return false;
    }
    showLoading("Saving profile...");
    try {
        const profileRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        await updateDoc(profileRef, { ...updates, updatedAt: serverTimestamp() });
        // Update local profile object
        userProfile = { ...userProfile, ...updates };
        console.log("[Profile] Profile details updated in Firestore and locally.");
        updateProfileDisplay(); // Refresh UI
        showMessage("Profile Saved", "Your profile details have been updated.", "success");
        return true;
    } catch (error) {
        console.error("Error saving profile details:", error);
        logErrorToFirestore("saveProfileDetails", error.message, error);
        showMessage("Save Error", "Could not save your profile. " + error.message, "error");
        return false;
    } finally {
        hideLoading();
    }
}
async function uploadProfileDocuments() {
    if (!fbStorage || !currentUserId || !profileFileUploadElement || !profileFileUploadElement.files || profileFileUploadElement.files.length === 0) {
        showMessage("Upload Error", "Please select a file to upload.", "warning");
        return;
    }
    const filesToUpload = Array.from(profileFileUploadElement.files);
    showLoading(`Uploading ${filesToUpload.length} file(s)...`);

    try {
        const uploadPromises = filesToUpload.map(async (file) => {
            const filePath = `artifacts/${appId}/users/${currentUserId}/profileDocuments/${Date.now()}_${file.name}`;
            const fileRef = ref(fbStorage, filePath);
            await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(fileRef);
            return { name: file.name, url: downloadURL, path: filePath, uploadedAt: serverTimestamp() };
        });

        const uploadedFileMetadatas = await Promise.all(uploadPromises);

        // Update Firestore with new file metadata
        const profileRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        await updateDoc(profileRef, {
            uploadedFiles: arrayUnion(...uploadedFileMetadatas),
            updatedAt: serverTimestamp()
        });

        // Update local profile
        if (!userProfile.uploadedFiles) userProfile.uploadedFiles = [];
        // Convert serverTimestamp to a client-side recognizable format or handle it appropriately on read
        const clientReadyFiles = uploadedFileMetadatas.map(f => ({...f, uploadedAt: new Date()})); // Approximate for immediate UI
        userProfile.uploadedFiles.push(...clientReadyFiles);


        renderProfileFilesList(); // Refresh the list
        showMessage("Upload Successful", `${filesToUpload.length} file(s) uploaded successfully.`, "success");
        profileFileUploadElement.value = ''; // Clear file input

    } catch (error) {
        console.error("Error uploading profile documents:", error);
        logErrorToFirestore("uploadProfileDocuments", error.message, error);
        showMessage("Upload Failed", "Could not upload files. " + error.message, "error");
    } finally {
        hideLoading();
    }
}
window.confirmDeleteProfileDocument = (fileName, filePath) => {
    // Replace with a proper modal confirmation
    if (confirm(`Are you sure you want to delete the document "${fileName}"? This cannot be undone.`)) {
        executeDeleteProfileDocument(fileName, filePath);
    }
};
window.executeDeleteProfileDocument = async (fileName, filePath) => {
    if (!fbStorage || !fsDb || !currentUserId || !filePath) {
        showMessage("Delete Error", "Could not delete file. System error.", "error");
        return;
    }
    showLoading(`Deleting ${fileName}...`);
    try {
        // Delete from Storage
        const fileRef = ref(fbStorage, filePath);
        await deleteObject(fileRef);
        console.log("[Profile] File deleted from Storage:", filePath);

        // Remove from Firestore
        const profileRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        // Find the specific file object to remove using arrayRemove. This requires fetching the current state or knowing the exact object.
        // A simpler way if objects are complex is to fetch, filter, and set. But for simple structures, arrayRemove with the known object works.
        // We need the exact object that was stored, including its serverTimestamp if that was part of it.
        // For simplicity, let's assume we refetch and update. Or, if we stored simple objects:
        const fileToRemove = (userProfile.uploadedFiles || []).find(f => f.path === filePath);
        if (fileToRemove) {
            await updateDoc(profileRef, {
                uploadedFiles: arrayRemove(fileToRemove), // This requires fileToRemove to be the exact object stored
                updatedAt: serverTimestamp()
            });

            // Update local profile
            userProfile.uploadedFiles = (userProfile.uploadedFiles || []).filter(f => f.path !== filePath);
            renderProfileFilesList(); // Refresh list
            showMessage("File Deleted", `"${fileName}" has been deleted.`, "success");
        } else {
             console.warn("[Profile] Could not find file metadata in local profile to remove from Firestore array:", filePath);
             // Fallback: Fetch profile, filter, and update. This is safer.
             const currentProfileSnap = await getDoc(profileRef);
             if (currentProfileSnap.exists()) {
                 const currentProfileData = currentProfileSnap.data();
                 const updatedFiles = (currentProfileData.uploadedFiles || []).filter(f => f.path !== filePath);
                 await updateDoc(profileRef, { uploadedFiles: updatedFiles, updatedAt: serverTimestamp() });
                 userProfile.uploadedFiles = updatedFiles;
                 renderProfileFilesList();
                 showMessage("File Deleted", `"${fileName}" has been deleted.`, "success");
             } else {
                throw new Error("Profile document not found during delete operation.");
             }
        }
    } catch (error) {
        console.error("Error deleting profile document:", error);
        logErrorToFirestore("executeDeleteProfileDocument", error.message, {fileName, filePath});
        showMessage("Delete Failed", `Could not delete "${fileName}". ${error.message}`, "error");
    } finally {
        hideLoading();
    }
};

/* ========== Invoice Functions ========== */
function renderInvoiceSection() {
    if (!userProfile || !currentUserId) {
        console.warn("[Invoice] Cannot render invoice section: User profile not loaded.");
        // navigateToSection('home');
        return;
    }
    console.log("[Invoice] Rendering invoice section.");
    populateInvoiceHeader();
    loadUserInvoiceDraft(); // Load existing draft or start new
}

function populateInvoiceHeader() {
    if (!userProfile) return;

    if(invoiceDateInputElement) invoiceDateInputElement.value = formatDateForInput(new Date());
    if(invoiceWeekLabelElement && invoiceDateInputElement) invoiceWeekLabelElement.textContent = getWeekNumber(new Date(invoiceDateInputElement.value));
    if(invoiceNumberInputElement) invoiceNumberInputElement.value = userProfile.nextInvoiceNumber || '1001'; // Use from profile or default

    if(providerNameInputElement) providerNameInputElement.value = userProfile.name || '';
    if(providerAbnInputElement) providerAbnInputElement.value = userProfile.abn || '';
    if(gstFlagInputElement) gstFlagInputElement.checked = userProfile.gstRegistered || false;

    // Set participant and plan manager details from global settings (or user-specific if applicable)
    // These might be editable per invoice or fixed depending on portal type
    // For now, assume they come from global settings as defaults
    const participantNameInput = $("#invParticipantName"); // Assuming IDs like this
    const participantNdisInput = $("#invParticipantNdisNo");
    const planManagerNameInput = $("#invPlanManagerName");
    const planManagerEmailInput = $("#invPlanManagerEmail");

    if(participantNameInput) participantNameInput.value = globalSettings.defaultParticipantName || '';
    if(participantNdisInput) participantNdisInput.value = globalSettings.defaultParticipantNdisNo || '';
    if(planManagerNameInput) planManagerNameInput.value = globalSettings.defaultPlanManagerName || '';
    if(planManagerEmailInput) planManagerEmailInput.value = globalSettings.defaultPlanManagerEmail || '';

    // Handle GST display based on flag
    if(gstRowElement) gstRowElement.style.display = gstFlagInputElement.checked ? '' : 'none';
    gstFlagInputElement.addEventListener('change', () => {
        if(gstRowElement) gstRowElement.style.display = gstFlagInputElement.checked ? '' : 'none';
        updateInvoiceTotals();
    });
}

function renderInvoiceTable() {
    if (!invoiceTableBodyElement) return;
    invoiceTableBodyElement.innerHTML = ''; // Clear existing rows
    currentInvoiceData.items.forEach((item, index) => {
        addInvoiceRowToTable(item, index);
    });
    if (currentInvoiceData.items.length === 0) {
        addInvRowUserAction(); // Add one empty row if no items
    }
    updateInvoiceTotals();
}

function addInvoiceRowToTable(item = {}, index = -1) {
    if (!invoiceTableBodyElement) return;
    const newRow = invoiceTableBodyElement.insertRow(index);
    newRow.classList.add('invoice-item-row');
    newRow.innerHTML = `
        <td><input type="date" class="form-input inv-item-date" value="${item.date ? formatDateForInput(item.date) : formatDateForInput(new Date())}"></td>
        <td><input type="text" class="form-input inv-item-desc" placeholder="Service Description" value="${item.description || ''}"></td>
        <td>
            <select class="form-input inv-item-service-code">
                <option value="">Select Service</option>
                ${adminManagedServices.map(s => `<option value="${s.id}" ${item.serviceId === s.id ? 'selected' : ''} data-rate="${s.rates ? s.rates.weekday : '0'}" data-travel-code="${s.travelCode || ''}">${s.description} (${s.serviceCode})</option>`).join('')}
            </select>
        </td>
        <td><input type="time" class="form-input inv-item-start" value="${item.startTime || '09:00'}"></td>
        <td><input type="time" class="form-input inv-item-end" value="${item.endTime || '10:00'}"></td>
        <td><input type="number" class="form-input inv-item-hours" value="${item.hours || '1.00'}" step="0.01" readonly></td>
        <td><input type="number" class="form-input inv-item-rate" value="${item.rate || '0.00'}" step="0.01"></td>
        <td><input type="number" class="form-input inv-item-total" value="${item.total || '0.00'}" step="0.01" readonly></td>
        <td><button class="btn btn-danger btn-sm" onclick="window.deleteInvoiceRow(this)"><i class="fas fa-trash"></i></button></td>
    `;
    // Add event listeners to new row inputs for dynamic calculation
    newRow.querySelectorAll('.inv-item-start, .inv-item-end, .inv-item-rate, .inv-item-service-code, .inv-item-date').forEach(input => {
        input.addEventListener('change', () => updateInvoiceItemFromRow(newRow, newRow.rowIndex -1));
    });
    // Trigger initial calculation for the row
    updateInvoiceItemFromRow(newRow, newRow.rowIndex -1);
}

function addInvRowUserAction() {
    addInvoiceRowToTable({}, currentInvoiceData.items.length); // Add to end
    currentInvoiceData.items.push({}); // Add placeholder to data model
    updateInvoiceTotals();
}


function updateInvoiceItemFromRow(row, index) {
    if (!row || index < 0 || index >= currentInvoiceData.items.length) return;

    const dateInput = row.querySelector('.inv-item-date');
    const descInput = row.querySelector('.inv-item-desc');
    const serviceCodeSelect = row.querySelector('.inv-item-service-code');
    const startInput = row.querySelector('.inv-item-start');
    const endInput = row.querySelector('.inv-item-end');
    const hoursInput = row.querySelector('.inv-item-hours');
    const rateInput = row.querySelector('.inv-item-rate');
    const totalInput = row.querySelector('.inv-item-total');

    const item = currentInvoiceData.items[index];

    item.date = dateInput.value;
    item.description = descInput.value;
    item.startTime = startInput.value;
    item.endTime = endInput.value;

    const selectedServiceOption = serviceCodeSelect.options[serviceCodeSelect.selectedIndex];
    item.serviceId = selectedServiceOption.value;

    // Auto-populate description and rate if a service is selected and description is empty
    if (item.serviceId) {
        const service = adminManagedServices.find(s => s.id === item.serviceId);
        if (service) {
            if (!item.description) { // Only if description is empty
                descInput.value = service.description;
                item.description = service.description;
            }
            // Determine rate based on date and time
            const rateType = determineRateType(item.date, item.startTime); // e.g., 'weekday', 'saturday'
            const serviceRate = service.rates && service.rates[rateType] ? service.rates[rateType] : (service.rates ? service.rates.weekday || 0 : 0); // Fallback to weekday or 0
            rateInput.value = parseFloat(serviceRate).toFixed(2);
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

window.deleteInvoiceRow = (btn) => {
    const row = btn.closest('tr');
    if (!row || !invoiceTableBodyElement) return;
    const idx = Array.from(invoiceTableBodyElement.children).indexOf(row); // More robust index finding

    if (idx > -1 && idx < currentInvoiceData.items.length) {
        currentInvoiceData.items.splice(idx, 1);
        row.remove();
        updateInvoiceTotals();
        console.log("[Invoice] Row deleted at index:", idx);
    } else {
        console.warn("[Invoice] Could not delete row, index out of bounds or row not found in table body.");
    }
};

function updateInvoiceTotals() {
    let subtotal = 0;
    currentInvoiceData.items.forEach(item => {
        subtotal += item.total || 0;
    });
    currentInvoiceData.subtotal = subtotal;

    let gstAmount = 0;
    if (gstFlagInputElement && gstFlagInputElement.checked) {
        gstAmount = subtotal * 0.10; // 10% GST
    }
    currentInvoiceData.gst = gstAmount;

    const grandTotal = subtotal + gstAmount;
    currentInvoiceData.grandTotal = grandTotal;

    if(subtotalElement) subtotalElement.textContent = formatCurrency(subtotal);
    if(gstAmountElement) gstAmountElement.textContent = formatCurrency(gstAmount);
    if(grandTotalElement) grandTotalElement.textContent = formatCurrency(grandTotal);

    console.log("[Invoice] Totals updated:", currentInvoiceData);
}

async function saveInvoiceDraft() {
    if (!fsDb || !currentUserId || !userProfile) {
        showMessage("Error", "Cannot save draft. User not logged in or system error.", "error");
        return;
    }
    // Collect all header data
    currentInvoiceData.invoiceNumber = invoiceNumberInputElement.value;
    currentInvoiceData.invoiceDate = invoiceDateInputElement.value;
    currentInvoiceData.providerName = providerNameInputElement.value;
    currentInvoiceData.providerAbn = providerAbnInputElement.value;
    currentInvoiceData.gstRegistered = gstFlagInputElement.checked;

    // Collect participant and plan manager details from inputs
    currentInvoiceData.participantName = $("#invParticipantName")?.value || globalSettings.defaultParticipantName;
    currentInvoiceData.participantNdisNo = $("#invParticipantNdisNo")?.value || globalSettings.defaultParticipantNdisNo;
    currentInvoiceData.planManagerName = $("#invPlanManagerName")?.value || globalSettings.defaultPlanManagerName;
    currentInvoiceData.planManagerEmail = $("#invPlanManagerEmail")?.value || globalSettings.defaultPlanManagerEmail;


    showLoading("Saving draft...");
    try {
        const draftRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, "draft");
        await setDoc(draftRef, { ...currentInvoiceData, lastSaved: serverTimestamp() });
        showMessage("Draft Saved", "Your invoice draft has been saved.", "success");
        console.log("[Invoice] Draft saved to Firestore.");
    } catch (error) {
        console.error("Error saving invoice draft:", error);
        logErrorToFirestore("saveInvoiceDraft", error.message, error);
        showMessage("Save Failed", "Could not save draft. " + error.message, "error");
    } finally {
        hideLoading();
    }
}

async function loadUserInvoiceDraft() {
    if (!fsDb || !currentUserId) {
        // Initialize with a new empty draft if no user or DB
        currentInvoiceData = { items: [], invoiceNumber: userProfile.nextInvoiceNumber || "1001", invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0 };
        renderInvoiceTable();
        return;
    }
    showLoading("Loading draft...");
    try {
        const draftRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, "draft");
        const snap = await getDoc(draftRef);
        if (snap.exists()) {
            currentInvoiceData = snap.data();
            // Convert Firestore Timestamps in items back to string dates if necessary
            currentInvoiceData.items = currentInvoiceData.items.map(item => ({
                ...item,
                date: item.date ? (item.date.toDate ? formatDateForInput(item.date.toDate()) : formatDateForInput(new Date(item.date))) : formatDateForInput(new Date())
            }));
            console.log("[Invoice] Draft loaded from Firestore.");
        } else {
            console.log("[Invoice] No existing draft found. Starting new.");
            currentInvoiceData = { items: [], invoiceNumber: userProfile.nextInvoiceNumber || "1001", invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0 };
        }
        // Populate header fields from loaded/new draft data
        if(invoiceNumberInputElement) invoiceNumberInputElement.value = currentInvoiceData.invoiceNumber;
        if(invoiceDateInputElement) invoiceDateInputElement.value = currentInvoiceData.invoiceDate ? formatDateForInput(new Date(currentInvoiceData.invoiceDate)) : formatDateForInput(new Date());
        if(providerNameInputElement && currentInvoiceData.providerName) providerNameInputElement.value = currentInvoiceData.providerName;
        if(providerAbnInputElement && currentInvoiceData.providerAbn) providerAbnInputElement.value = currentInvoiceData.providerAbn;
        if(gstFlagInputElement && typeof currentInvoiceData.gstRegistered === 'boolean') gstFlagInputElement.checked = currentInvoiceData.gstRegistered;

        $("#invParticipantName").value = currentInvoiceData.participantName || globalSettings.defaultParticipantName;
        $("#invParticipantNdisNo").value = currentInvoiceData.participantNdisNo || globalSettings.defaultParticipantNdisNo;
        $("#invPlanManagerName").value = currentInvoiceData.planManagerName || globalSettings.defaultPlanManagerName;
        $("#invPlanManagerEmail").value = currentInvoiceData.planManagerEmail || globalSettings.defaultPlanManagerEmail;


        if(invoiceWeekLabelElement && invoiceDateInputElement.value) invoiceWeekLabelElement.textContent = getWeekNumber(new Date(invoiceDateInputElement.value));
        if(gstRowElement) gstRowElement.style.display = gstFlagInputElement.checked ? '' : 'none';


        renderInvoiceTable(); // This will also call updateInvoiceTotals
    } catch (error) {
        console.error("Error loading invoice draft:", error);
        logErrorToFirestore("loadUserInvoiceDraft", error.message, error);
        showMessage("Load Failed", "Could not load draft. " + error.message, "error");
        currentInvoiceData = { items: [], invoiceNumber: userProfile.nextInvoiceNumber || "1001", invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0 };
        renderInvoiceTable();
    } finally {
        hideLoading();
    }
}

async function saveInitialInvoiceNumber() {
    if (!initialInvoiceNumberInputElement) return;
    const numStr = initialInvoiceNumberInputElement.value;
    const n = parseInt(numStr, 10);
    if (isNaN(n) || n <= 0) {
        showMessage("Invalid Number", "Please enter a positive whole number for the initial invoice.", "warning");
        return;
    }
    if (userProfile) { // Ensure userProfile is loaded
        userProfile.nextInvoiceNumber = n;
        const success = await saveProfileDetails({ nextInvoiceNumber: n });
        if (success) {
            closeModal('setInitialInvoiceModal');
            if(invoiceNumberInputElement) invoiceNumberInputElement.value = n; // Update current invoice form
            showMessage("Invoice Number Set", `Your next invoice number will start from ${n}.`, "success");
        } else {
            showMessage("Error", "Could not save initial invoice number.", "error");
        }
    } else {
        showMessage("Error", "User profile not loaded. Cannot save setting.", "error");
    }
}

function generateInvoicePdf() {
    if (!currentInvoiceData || !invoicePdfContentElement) {
        showMessage("Error", "No invoice data to generate PDF.", "error");
        return;
    }
    if (typeof html2pdf === 'undefined') {
        showMessage("Error", "PDF generation library not loaded.", "error");
        logErrorToFirestore("generateInvoicePdf", "html2pdf library not found");
        return;
    }

    showLoading("Generating PDF...");

    // Populate the hidden PDF content div
    // Header
    $("#pdfInvoiceTitle").textContent = userProfile.isAdmin ? "TAX INVOICE (Copy)" : "TAX INVOICE";
    $("#pdfProviderName").textContent = currentInvoiceData.providerName || userProfile.name;
    $("#pdfProviderAbn").textContent = `ABN: ${currentInvoiceData.providerAbn || userProfile.abn}`;
    $("#pdfProviderContact").textContent = userProfile.email; // Or a dedicated contact if available

    $("#pdfInvoiceNumber").textContent = currentInvoiceData.invoiceNumber;
    $("#pdfInvoiceDate").textContent = formatDateForDisplay(new Date(currentInvoiceData.invoiceDate));
    $("#pdfInvoiceTo").textContent = currentInvoiceData.planManagerName || globalSettings.defaultPlanManagerName; // Bill to Plan Manager
    $("#pdfParticipantName").textContent = currentInvoiceData.participantName || globalSettings.defaultParticipantName;
    $("#pdfParticipantNdisNo").textContent = currentInvoiceData.participantNdisNo || globalSettings.defaultParticipantNdisNo;


    // Items Table
    const pdfTableBody = $("#pdfInvoiceTableBody");
    pdfTableBody.innerHTML = ''; // Clear previous
    currentInvoiceData.items.forEach(item => {
        const row = pdfTableBody.insertRow();
        row.innerHTML = `
            <td>${formatDateForDisplay(new Date(item.date))}</td>
            <td>${item.description}</td>
            <td>${item.hours.toFixed(2)}</td>
            <td>${formatCurrency(item.rate)}</td>
            <td>${formatCurrency(item.total)}</td>
        `;
    });

    // Totals
    $("#pdfSubtotal").textContent = formatCurrency(currentInvoiceData.subtotal);
    const pdfGstRow = $("#pdfGstRow");
    if (currentInvoiceData.gstRegistered && currentInvoiceData.gst > 0) {
        $("#pdfGstAmount").textContent = formatCurrency(currentInvoiceData.gst);
        pdfGstRow.style.display = '';
    } else {
        pdfGstRow.style.display = 'none';
    }
    $("#pdfGrandTotal").textContent = formatCurrency(currentInvoiceData.grandTotal);

    // Bank Details
    $("#pdfBankName").textContent = userProfile.bankName || globalSettings.defaultBankName || "Your Bank Name"; // Add these to profile/settings
    $("#pdfBankBsb").textContent = userProfile.bsb || "000-000";
    $("#pdfBankAcc").textContent = userProfile.acc || "00000000";
    $("#pdfBankAccName").textContent = userProfile.accountName || userProfile.name || "Your Account Name";


    const opt = {
        margin:       0.5,
        filename:     `Invoice-${currentInvoiceData.invoiceNumber}-${currentInvoiceData.participantName}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(invoicePdfContentElement).set(opt).save()
        .then(() => {
            hideLoading();
            showMessage("PDF Generated", "Invoice PDF has been downloaded.", "success");
            // Optionally, increment invoice number if this is considered "finalizing"
            if (!userProfile.isAdmin) { // Don't auto-increment for admin copies
                const nextInvNum = parseInt(currentInvoiceData.invoiceNumber, 10) + 1;
                if (userProfile) {
                    userProfile.nextInvoiceNumber = nextInvNum;
                    saveProfileDetails({ nextInvoiceNumber: nextInvNum }); // Save silently or with confirmation
                    if(invoiceNumberInputElement) invoiceNumberInputElement.value = nextInvNum; // Update UI for next invoice
                }
                // Clear current draft for next invoice
                currentInvoiceData = { items: [], invoiceNumber: String(nextInvNum), invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0 };
                renderInvoiceTable();
            }
        })
        .catch(err => {
            hideLoading();
            console.error("PDF Generation Error:", err);
            logErrorToFirestore("generateInvoicePdf", err.message, err);
            showMessage("PDF Error", "Could not generate PDF. " + err.message, "error");
        });
}


/* ========== Agreement Functions ========== */
function renderAgreementSection() {
    if (!userProfile || !currentUserId) {
        console.warn("[Agreement] Cannot render agreement: User profile not loaded.");
        // navigateToSection('home');
        return;
    }
    console.log("[Agreement] Rendering agreement section.");

    if (userProfile.isAdmin) {
        if(adminAgreementWorkerSelectorElement) adminAgreementWorkerSelectorElement.style.display = 'block';
        if(adminSelectWorkerForAgreementElement) adminSelectWorkerForAgreementElement.innerHTML = '<option value="">Select Worker for Agreement</option>'; // Clear and add default
        Object.values(allUsersCache).filter(u => !u.isAdmin).forEach(worker => {
            const option = document.createElement('option');
            option.value = worker.email;
            option.textContent = `${worker.name} (${worker.email})`;
            if(adminSelectWorkerForAgreementElement) adminSelectWorkerForAgreementElement.appendChild(option);
        });
        // Initially load for admin self, or prompt to select worker
        currentAgreementWorkerEmail = currentUserEmail; // Default to admin's own details if they are also a provider
        loadAndRenderServiceAgreement(currentAgreementWorkerEmail); // Or pass null to show a placeholder
    } else {
        // For regular users, load their own agreement
        if(adminAgreementWorkerSelectorElement) adminAgreementWorkerSelectorElement.style.display = 'none';
        currentAgreementWorkerEmail = currentUserEmail;
        loadAndRenderServiceAgreement(currentAgreementWorkerEmail);
    }
}

async function loadAndRenderServiceAgreement(workerEmail = null) {
    if (!fsDb || !workerEmail) {
        if(agreementContentContainerElement) agreementContentContainerElement.innerHTML = "<p>Please select a worker to view their service agreement or complete your profile.</p>";
        updateAgreementChip(null);
        return;
    }
    showLoading("Loading agreement...");
    try {
        // Path to agreement: artifacts/{appId}/users/{workerEmail (as ID)}/agreement/details (6 segments)
        // Note: Using email as document ID for worker-specific data under 'users' collection might be problematic if emails change.
        // It's generally better to use UID. Assuming workerEmail is a stand-in for worker's UID here or a lookup happens.
        // For this example, let's assume we have the worker's UID. If workerEmail is indeed an email, we need to find the UID first.

        let targetWorkerUid = null;
        let workerProfileToUse = null;

        if (workerEmail === currentUserEmail) { // Current user is the worker
            targetWorkerUid = currentUserId;
            workerProfileToUse = userProfile;
        } else if (userProfile.isAdmin && allUsersCache[workerEmail]) { // Admin looking up another worker
            workerProfileToUse = allUsersCache[workerEmail];
            targetWorkerUid = workerProfileToUse.uid;
        } else if (userProfile.isAdmin) { // Admin looking up, but worker not in cache (should be rare if cache is up to date)
            const worker = Object.values(allUsersCache).find(u => u.email === workerEmail);
            if (worker) {
                workerProfileToUse = worker;
                targetWorkerUid = worker.uid;
            }
        }


        if (!targetWorkerUid || !workerProfileToUse) {
            throw new Error(`Worker profile not found for ${workerEmail}`);
        }


        const agreementRef = doc(fsDb, `artifacts/${appId}/users/${targetWorkerUid}/agreement`, "details");
        const agreementSnap = await getDoc(agreementRef);
        let agreementData;

        if (agreementSnap.exists()) {
            agreementData = agreementSnap.data();
            console.log("[Agreement] Loaded existing agreement for:", workerEmail);
        } else {
            console.log("[Agreement] No existing agreement found for:", workerEmail, ". Creating new from template.");
            // Create a new agreement structure if it doesn't exist
            agreementData = {
                workerUid: targetWorkerUid,
                workerEmail: workerProfileToUse.email, // Store email for reference
                participantSignature: null, participantSignatureDate: null,
                workerSignature: null, workerSignatureDate: null,
                createdAt: serverTimestamp(),
                // Other fields like agreement version, specific clauses if they differ from global template
            };
            // No need to save it here yet, render first. Save happens on signing.
        }

        // Store current agreement data globally for signing functions
        window.currentLoadedAgreement = agreementData;
        window.currentLoadedAgreementWorkerUid = targetWorkerUid; // Store UID for saving

        renderAgreementClauses(workerProfileToUse, globalSettings, agreementData);
        updateAgreementChip(agreementData);

    } catch (error) {
        console.error("Error loading/rendering service agreement:", error);
        logErrorToFirestore("loadAndRenderServiceAgreement", error.message, { workerEmail });
        if(agreementContentContainerElement) agreementContentContainerElement.innerHTML = `<p class="text-danger">Could not load service agreement: ${error.message}</p>`;
        updateAgreementChip(null);
    } finally {
        hideLoading();
    }
}

function renderAgreementClauses(worker, settings, agreementState) {
    if (!agreementContentContainerElement || !worker || !settings || !agreementCustomData) {
        console.error("Cannot render agreement clauses: Missing elements or data.");
        if(agreementContentContainerElement) agreementContentContainerElement.innerHTML = "<p>Error: Missing data to render agreement.</p>";
        return;
    }
    agreementContentContainerElement.innerHTML = ''; // Clear previous

    // Use the overall title from the customized template
    if(agreementDynamicTitleElement) agreementDynamicTitleElement.textContent = agreementCustomData.overallTitle || defaultAgreementCustomData.overallTitle;


    // Placeholder replacements
    const replacements = {
        '{{participantName}}': settings.defaultParticipantName || "The Participant",
        '{{participantNdisNo}}': settings.defaultParticipantNdisNo || "N/A",
        '{{planEndDate}}': formatDateForDisplay(settings.defaultPlanEndDate) || "N/A",
        '{{workerName}}': worker.name || "The Provider",
        '{{workerAbn}}': worker.abn || "N/A",
        '{{serviceList}}': (worker.authorizedServices && worker.authorizedServices.length > 0)
            ? `<ul>${worker.authorizedServices.map(sId => {
                    const service = adminManagedServices.find(as => as.id === sId);
                    return service ? `<li>${service.description} (${service.serviceCode})</li>` : `<li>Unknown Service ID: ${sId}</li>`;
                  }).join('')}</ul>`
            : "No specific services authorized/listed. General support services as agreed.",
        '{{planManagerName}}': settings.defaultPlanManagerName || "The Plan Manager",
        '{{planManagerEmail}}': settings.defaultPlanManagerEmail || "N/A",
        '{{agreementStartDate}}': formatDateForDisplay(agreementState.createdAt) || formatDateForDisplay(new Date()), // Use agreement creation or today
        '{{agreementEndDate}}': formatDateForDisplay(settings.defaultPlanEndDate) || "Plan End Date" // Typically tied to plan
    };

    // Render clauses from the customized template
    (agreementCustomData.clauses || defaultAgreementCustomData.clauses).forEach(clause => {
        const clauseDiv = document.createElement('div');
        clauseDiv.classList.add('agreement-clause');
        let clauseBody = clause.body;
        for (const key in replacements) {
            clauseBody = clauseBody.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacements[key]);
        }
        // Basic Markdown-like replacements for **bold** and \n to <br>
        clauseBody = clauseBody.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

        clauseDiv.innerHTML = `<h3>${clause.heading}</h3><p>${clauseBody}</p>`;
        agreementContentContainerElement.appendChild(clauseDiv);
    });

    // Signatures display
    if (agreementState.participantSignature && participantSignatureImageElement) {
        participantSignatureImageElement.src = agreementState.participantSignature;
        participantSignatureImageElement.style.display = 'block';
        if(participantSignatureDateElement) participantSignatureDateElement.textContent = `Signed: ${formatDateForDisplay(agreementState.participantSignatureDate)}`;
    } else {
        if(participantSignatureImageElement) participantSignatureImageElement.style.display = 'none';
        if(participantSignatureDateElement) participantSignatureDateElement.textContent = 'Not signed by participant.';
    }

    if (agreementState.workerSignature && workerSignatureImageElement) {
        workerSignatureImageElement.src = agreementState.workerSignature;
        workerSignatureImageElement.style.display = 'block';
        if(workerSignatureDateElement) workerSignatureDateElement.textContent = `Signed: ${formatDateForDisplay(agreementState.workerSignatureDate)}`;
    } else {
        if(workerSignatureImageElement) workerSignatureImageElement.style.display = 'none';
        if(workerSignatureDateElement) workerSignatureDateElement.textContent = 'Not signed by worker.';
    }

    // Control button visibility based on who is viewing and signature state
    const isCurrentUserTheWorker = currentUserId === worker.uid;
    const isAdminViewing = userProfile.isAdmin && !isCurrentUserTheWorker;

    if(signAgreementButtonElement) signAgreementButtonElement.style.display = (isCurrentUserTheWorker && !agreementState.workerSignature) ? 'inline-block' : 'none';
    if(participantSignButtonElement) participantSignButtonElement.style.display = (isAdminViewing && !agreementState.participantSignature) ? 'inline-block' : 'none'; // Admin signs as participant proxy

    console.log("[Agreement] Clauses rendered.");
}


function updateAgreementChip(agreementState) {
    if (!agreementChipElement) return;
    if (!agreementState || (!agreementState.workerSignature && !agreementState.participantSignature)) {
        agreementChipElement.textContent = "Unsigned";
        agreementChipElement.className = 'chip chip-red';
    } else if (agreementState.workerSignature && agreementState.participantSignature) {
        agreementChipElement.textContent = "Fully Signed";
        agreementChipElement.className = 'chip chip-green';
    } else {
        agreementChipElement.textContent = "Partially Signed";
        agreementChipElement.className = 'chip chip-orange';
    }
}

function openSignatureModal(whoIsSigning) { // 'worker' or 'participant'
    signingAs = whoIsSigning; // Set who is currently signing
    openModal('sigModal');
    initializeSignaturePad();
}

function initializeSignaturePad() {
    if (!signatureCanvasElement) return;
    sigCanvas = signatureCanvasElement;
    sigCtx = sigCanvas.getContext('2d');

    // Set canvas size (consider display density for crispness)
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    sigCanvas.width = sigCanvas.offsetWidth * ratio;
    sigCanvas.height = sigCanvas.offsetHeight * ratio;
    sigCtx.scale(ratio, ratio);

    sigCtx.strokeStyle = "#000000"; // Black ink
    sigCtx.lineWidth = 2;
    sigCtx.lineCap = "round";
    sigCtx.lineJoin = "round";

    clearSignaturePad(); // Clear any previous drawing

    // Remove old listeners before adding new ones to prevent duplicates
    sigCanvas.removeEventListener('mousedown', sigStart);
    sigCanvas.removeEventListener('mousemove', sigDraw);
    sigCanvas.removeEventListener('mouseup', sigEnd);
    sigCanvas.removeEventListener('mouseout', sigEnd);
    sigCanvas.removeEventListener('touchstart', sigStart);
    sigCanvas.removeEventListener('touchmove', sigDraw);
    sigCanvas.removeEventListener('touchend', sigEnd);

    // Add event listeners for mouse
    sigCanvas.addEventListener('mousedown', sigStart, false);
    sigCanvas.addEventListener('mousemove', sigDraw, false);
    sigCanvas.addEventListener('mouseup', sigEnd, false);
    sigCanvas.addEventListener('mouseout', sigEnd, false); // End draw if mouse leaves canvas

    // Add event listeners for touch
    sigCanvas.addEventListener('touchstart', sigStart, false);
    sigCanvas.addEventListener('touchmove', sigDraw, false);
    sigCanvas.addEventListener('touchend', sigEnd, false);
    console.log("[Signature] Pad initialized.");
}

function clearSignaturePad() {
    if (!sigCtx || !sigCanvas) return;
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    sigPaths = []; // Clear stored paths
    console.log("[Signature] Pad cleared.");
}

function sigStart(e) {
    e.preventDefault(); // Prevent scrolling on touch
    sigPen = true;
    const pos = getSigPenPosition(e);
    sigCtx.beginPath();
    sigCtx.moveTo(pos.x, pos.y);
    sigPaths.push([[pos.x, pos.y]]); // Start a new path
}

function sigDraw(e) {
    e.preventDefault();
    if (!sigPen) return;
    const pos = getSigPenPosition(e);
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.stroke();
    if (sigPaths.length > 0) {
        sigPaths[sigPaths.length - 1].push([pos.x, pos.y]); // Add point to current path
    }
}

function sigEnd(e) {
    e.preventDefault();
    if (!sigPen) return;
    sigPen = false;
    sigCtx.closePath();
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
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

async function saveSignature() {
    if (!sigCanvas || sigPaths.length === 0) {
        showMessage("Signature Error", "Please provide a signature before saving.", "warning");
        return;
    }
    if (!window.currentLoadedAgreement || !window.currentLoadedAgreementWorkerUid) {
        showMessage("Error", "No agreement loaded to save signature against.", "error");
        logErrorToFirestore("saveSignature", "Attempted to save signature without a loaded agreement context.");
        return;
    }

    const signatureDataUrl = sigCanvas.toDataURL('image/png');
    showLoading("Saving signature...");

    const agreementUpdate = {};
    const signatureDate = serverTimestamp(); // Use server timestamp for signing date

    if (signingAs === 'worker') {
        agreementUpdate.workerSignature = signatureDataUrl;
        agreementUpdate.workerSignatureDate = signatureDate;
    } else if (signingAs === 'participant') {
        agreementUpdate.participantSignature = signatureDataUrl;
        agreementUpdate.participantSignatureDate = signatureDate;
    } else {
        hideLoading();
        showMessage("Error", "Unknown signer type.", "error");
        logErrorToFirestore("saveSignature", "Unknown signingAs value", { signingAs });
        return;
    }

    try {
        const agreementRef = doc(fsDb, `artifacts/${appId}/users/${window.currentLoadedAgreementWorkerUid}/agreement`, "details");
        // Ensure the document exists before updating, or use set with merge if creating for the first time on sign
        const agreementSnap = await getDoc(agreementRef);
        if (agreementSnap.exists()) {
            await updateDoc(agreementRef, { ...agreementUpdate, updatedAt: serverTimestamp() });
        } else {
            // If agreement doc doesn't exist, create it with the signature
            const initialAgreementData = {
                workerUid: window.currentLoadedAgreementWorkerUid,
                workerEmail: allUsersCache[currentAgreementWorkerEmail]?.email || window.currentLoadedAgreement.workerEmail, // Get email from cache or loaded data
                createdAt: serverTimestamp(), // Should ideally be set when agreement is first viewed/generated
                ...agreementUpdate // Add the current signature
            };
            await setDoc(agreementRef, initialAgreementData);
        }


        console.log(`[Signature] ${signingAs} signature saved for UID: ${window.currentLoadedAgreementWorkerUid}`);
        closeModal('sigModal');
        showMessage("Signature Saved", `${signingAs}'s signature has been successfully saved.`, "success");

        // Reload and re-render the agreement to show the new signature and updated status
        await loadAndRenderServiceAgreement(currentAgreementWorkerEmail); // currentAgreementWorkerEmail should be the email of the worker whose agreement is being viewed

    } catch (error) {
        console.error(`Error saving ${signingAs} signature:`, error);
        logErrorToFirestore("saveSignature", error.message, { error, signingAs, workerUid: window.currentLoadedAgreementWorkerUid });
        showMessage("Save Failed", `Could not save ${signingAs} signature. ${error.message}`, "error");
    } finally {
        hideLoading();
    }
}

function generateAgreementPdf() {
    if (!agreementContentWrapperElement || !agreementHeaderForPdfElement) {
        showMessage("PDF Error", "Agreement content elements not found for PDF generation.", "error");
        return;
    }
     if (typeof html2pdf === 'undefined') {
        showMessage("Error", "PDF generation library not loaded.", "error");
        logErrorToFirestore("generateAgreementPdf", "html2pdf library not found");
        return;
    }

    showLoading("Generating Agreement PDF...");

    // Temporarily make the PDF header visible for rendering
    agreementHeaderForPdfElement.style.display = 'block';

    // Get worker name for filename, fallback if not available
    const workerProfileForPdf = allUsersCache[currentAgreementWorkerEmail] || userProfile; // Use cached or current user
    const workerNameForFile = workerProfileForPdf.name ? workerProfileForPdf.name.replace(/\s+/g, '_') : 'Agreement';
    const participantNameForFile = (globalSettings.defaultParticipantName || "Participant").replace(/\s+/g, '_');


    const opt = {
        margin:       [0.5, 0.5, 0.5, 0.5], // top, left, bottom, right margins in inches
        filename:     `ServiceAgreement-${workerNameForFile}-${participantNameForFile}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, scrollY: -window.scrollY }, // try to capture from top
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } // Try to avoid breaking elements
    };

    // Use the wrapper that contains both the header and the clauses
    html2pdf().from(agreementContentWrapperElement).set(opt).save()
        .then(() => {
            hideLoading();
            agreementHeaderForPdfElement.style.display = 'none'; // Hide header again
            showMessage("PDF Generated", "Service Agreement PDF has been downloaded.", "success");
        })
        .catch(err => {
            hideLoading();
            agreementHeaderForPdfElement.style.display = 'none'; // Hide header again
            console.error("Agreement PDF Generation Error:", err);
            logErrorToFirestore("generateAgreementPdf", err.message, err);
            showMessage("PDF Error", "Could not generate Agreement PDF. " + err.message, "error");
        });
}


/* ========== Admin Functions ========== */
function renderAdminDashboard() {
    if (!userProfile || !userProfile.isAdmin) {
        console.warn("[Admin] Non-admin attempting to render admin dashboard. Redirecting.");
        navigateToSection('home');
        return;
    }
    console.log("[Admin] Rendering admin dashboard.");
    // Default to the first admin tab or a specific overview tab
    switchAdminTab('adminGlobalSettings'); // Or 'adminOverview' if you create one
    renderAdminGlobalSettingsTab(); // Explicitly call render for the default tab
}

function switchAdminTab(targetId) {
    if (!adminNavTabButtons || !adminContentPanels) return;

    adminNavTabButtons.forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
    adminContentPanels.forEach(p => p.classList.toggle('active', p.id === targetId));

    console.log(`[Admin] Switched to admin tab: ${targetId}`);
    // Call specific render functions for each tab when it's switched to
    // This ensures data is fresh if it's loaded on demand.
    switch (targetId) {
        case 'adminGlobalSettings':
            renderAdminGlobalSettingsTab();
            break;
        case 'adminServiceManagement':
            renderAdminServiceManagementTab();
            break;
        case 'adminAgreementCustomization':
            renderAdminAgreementCustomizationTab();
            break;
        case 'adminWorkerManagement':
            renderAdminWorkerManagementTab();
            break;
        // Add cases for other admin tabs if any
        default:
            console.warn(`[Admin] No specific render logic for tab: ${targetId}`);
    }
}

function renderAdminGlobalSettingsTab() {
    if (!globalSettings) {
        console.warn("[Admin] Global settings not loaded. Cannot render settings tab.");
        return;
    }
    console.log("[Admin] Rendering Global Settings Tab.");

    // Populate Portal Type Radio Buttons
    if (adminWizardPortalTypeRadioElements) {
        adminWizardPortalTypeRadioElements.forEach(radio => {
            radio.checked = (radio.value === globalSettings.portalType);
        });
    }
    // Populate Organization Details
    if(adminEditOrgNameInputElement) adminEditOrgNameInputElement.value = globalSettings.organizationName || '';
    if(adminEditOrgAbnInputElement) adminEditOrgAbnInputElement.value = globalSettings.organizationAbn || '';
    if(adminEditOrgContactEmailInputElement) adminEditOrgContactEmailInputElement.value = globalSettings.organizationContactEmail || '';
    if(adminEditOrgContactPhoneInputElement) adminEditOrgContactPhoneInputElement.value = globalSettings.organizationContactPhone || '';

    // Populate Participant & Plan Manager Defaults
    if(adminEditParticipantNameInputElement) adminEditParticipantNameInputElement.value = globalSettings.defaultParticipantName || '';
    if(adminEditParticipantNdisNoInputElement) adminEditParticipantNdisNoInputElement.value = globalSettings.defaultParticipantNdisNo || '';
    if(adminEditPlanManagerNameInputElement) adminEditPlanManagerNameInputElement.value = globalSettings.defaultPlanManagerName || '';
    if(adminEditPlanManagerEmailInputElement) adminEditPlanManagerEmailInputElement.value = globalSettings.defaultPlanManagerEmail || '';
    if(adminEditPlanManagerPhoneInputElement) adminEditPlanManagerPhoneInputElement.value = globalSettings.defaultPlanManagerPhone || '';
    if(adminEditPlanEndDateInputElement) adminEditPlanEndDateInputElement.value = globalSettings.defaultPlanEndDate ? formatDateForInput(new Date(globalSettings.defaultPlanEndDate)) : '';

    // Invite Link (This is usually generated on demand or a fixed path)
    // For a simple implementation, it could be the portal URL.
    if(inviteLinkCodeElement) inviteLinkCodeElement.textContent = window.location.origin + window.location.pathname;
}

async function saveAdminPortalSettings() {
    if (!userProfile || !userProfile.isAdmin || !globalSettings) {
        showMessage("Error", "Not authorized or settings not loaded.", "error");
        return;
    }
    showLoading("Saving portal settings...");

    // Collect values from input fields
    const selectedPortalTypeRadio = $$("input[name='adminWizPortalType']:checked")[0];
    globalSettings.portalType = selectedPortalTypeRadio ? selectedPortalTypeRadio.value : globalSettings.portalType;

    globalSettings.organizationName = adminEditOrgNameInputElement.value.trim();
    globalSettings.organizationAbn = adminEditOrgAbnInputElement.value.trim();
    globalSettings.organizationContactEmail = adminEditOrgContactEmailInputElement.value.trim();
    globalSettings.organizationContactPhone = adminEditOrgContactPhoneInputElement.value.trim();

    globalSettings.defaultParticipantName = adminEditParticipantNameInputElement.value.trim();
    globalSettings.defaultParticipantNdisNo = adminEditParticipantNdisNoInputElement.value.trim();
    globalSettings.defaultPlanManagerName = adminEditPlanManagerNameInputElement.value.trim();
    globalSettings.defaultPlanManagerEmail = adminEditPlanManagerEmailInputElement.value.trim();
    globalSettings.defaultPlanManagerPhone = adminEditPlanManagerPhoneInputElement.value.trim();
    globalSettings.defaultPlanEndDate = adminEditPlanEndDateInputElement.value; // Already in YYYY-MM-DD

    // Assume globalSettings.setupComplete would be true if admin is saving these.
    // globalSettings.setupComplete = true; // Or manage this flag separately.

    const success = await saveGlobalSettingsToFirestore(); // This function already handles Firestore write
    hideLoading();
    if (success) {
        showMessage("Settings Saved", "Global portal settings have been updated.", "success");
    } else {
        showMessage("Save Failed", "Could not save portal settings. Check console for errors.", "error");
    }
}

window.confirmResetGlobalSettings = () => {
    // Replace with a proper modal confirmation
    if (confirm("Are you sure you want to reset all global settings to their default values? This action cannot be undone.")) {
        executeResetGlobalSettings();
    }
};

window.executeResetGlobalSettings = async () => {
    if (!userProfile || !userProfile.isAdmin) {
        showMessage("Error", "Not authorized to reset settings.", "error");
        return;
    }
    showLoading("Resetting settings...");
    globalSettings = getDefaultGlobalSettings(); // Get fresh defaults
    globalSettings.setupComplete = false; // Reset setup status as well
    agreementCustomData = JSON.parse(JSON.stringify(defaultAgreementCustomData)); // Reset agreement template
    globalSettings.agreementTemplate = agreementCustomData;


    const success = await saveGlobalSettingsToFirestore(); // Save the new default settings
    hideLoading();
    if (success) {
        renderAdminGlobalSettingsTab(); // Re-render tab to show defaults
        showMessage("Settings Reset", "Global portal settings have been reset to defaults.", "success");
    } else {
        showMessage("Reset Failed", "Could not reset settings. Check console for errors.", "error");
        // Attempt to reload current settings from DB if reset save failed
        await loadGlobalSettingsFromFirestore();
        renderAdminGlobalSettingsTab();
    }
};

function renderAdminServiceManagementTab() {
    console.log("[Admin] Rendering Service Management Tab.");
    clearAdminServiceForm(); // Clear form for new entry or edit
    renderAdminServicesTable(); // Display existing services
    populateServiceCategoryTypeDropdown(); // Populate dropdown for service types
    renderAdminServiceRateFields(); // Initialize rate fields based on default/current selection
}

function populateServiceCategoryTypeDropdown() {
    if (!adminServiceCategoryTypeSelectElement) return;
    adminServiceCategoryTypeSelectElement.innerHTML = '<option value="">-- Select Category Type --</option>'; // Clear and add default
    for (const key in SERVICE_CATEGORY_TYPES) {
        const option = document.createElement('option');
        option.value = SERVICE_CATEGORY_TYPES[key];
        // Make it more human-readable: CORE_STANDARD -> Core Standard
        option.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        adminServiceCategoryTypeSelectElement.appendChild(option);
    }
}

function renderAdminServiceRateFields() {
    if (!adminServiceRateFieldsContainerElement || !adminServiceCategoryTypeSelectElement) return;
    const selectedType = adminServiceCategoryTypeSelectElement.value;
    adminServiceRateFieldsContainerElement.innerHTML = ''; // Clear previous fields

    if (selectedType === SERVICE_CATEGORY_TYPES.TRAVEL_KM || selectedType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
        // Single rate field for travel or flat rate
        const rateDiv = document.createElement('div');
        rateDiv.classList.add('form-group', 'inline');
        rateDiv.innerHTML = `
            <label for="adminServiceRate_flat">Rate ($):</label>
            <input type="number" id="adminServiceRate_flat" class="form-input admin-service-rate" step="0.01" placeholder="0.00">
        `;
        adminServiceRateFieldsContainerElement.appendChild(rateDiv);
        if(adminServiceTravelCodeDisplayElement) adminServiceTravelCodeDisplayElement.style.display = (selectedType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) ? 'block' : 'none';
        if(selectTravelCodeButtonElement) selectTravelCodeButtonElement.style.display = (selectedType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) ? 'inline-block' : 'none';

    } else if (selectedType) { // For category types that use standard rate categories
        if(adminServiceTravelCodeDisplayElement) adminServiceTravelCodeDisplayElement.style.display = 'none';
        if(selectTravelCodeButtonElement) selectTravelCodeButtonElement.style.display = 'none';

        RATE_CATEGORIES.forEach(category => {
            const rateDiv = document.createElement('div');
            rateDiv.classList.add('form-group', 'inline');
            rateDiv.innerHTML = `
                <label for="adminServiceRate_${category}">${category.charAt(0).toUpperCase() + category.slice(1)} Rate ($):</label>
                <input type="number" id="adminServiceRate_${category}" class="form-input admin-service-rate" data-rate-category="${category}" step="0.01" placeholder="0.00">
            `;
            adminServiceRateFieldsContainerElement.appendChild(rateDiv);
        });
    } else {
         if(adminServiceTravelCodeDisplayElement) adminServiceTravelCodeDisplayElement.style.display = 'none';
         if(selectTravelCodeButtonElement) selectTravelCodeButtonElement.style.display = 'none';
    }
}

function clearAdminServiceForm() {
    currentAdminServiceEditingId = null; // Reset editing ID
    if(adminServiceIdInputElement) adminServiceIdInputElement.value = ''; // This might be hidden or auto-generated
    if(adminServiceCodeInputElement) adminServiceCodeInputElement.value = '';
    if(adminServiceDescriptionInputElement) adminServiceDescriptionInputElement.value = '';
    if(adminServiceCategoryTypeSelectElement) adminServiceCategoryTypeSelectElement.value = '';
    if(adminServiceTravelCodeInputElement) adminServiceTravelCodeInputElement.value = ''; // Hidden input for travel code ID
    if(adminServiceTravelCodeDisplayElement) adminServiceTravelCodeDisplayElement.textContent = 'No travel code selected.';


    renderAdminServiceRateFields(); // This will clear and render based on empty category type
    if(saveAdminServiceButtonElement) saveAdminServiceButtonElement.textContent = 'Save New Service';
    console.log("[Admin] Service form cleared.");
}

function renderAdminServicesTable() {
    if (!adminServicesTableBodyElement) return;
    adminServicesTableBodyElement.innerHTML = ''; // Clear existing rows

    if (adminManagedServices.length === 0) {
        adminServicesTableBodyElement.innerHTML = '<tr><td colspan="5">No services defined yet.</td></tr>';
        return;
    }

    adminManagedServices.forEach(service => {
        const row = adminServicesTableBodyElement.insertRow();
        // Display primary rate (e.g., weekday) or flat rate for brevity in table
        let displayRate = "N/A";
        if (service.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM || service.categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
            displayRate = service.rates && service.rates.flat ? formatCurrency(service.rates.flat) : formatCurrency(0);
        } else if (service.rates && service.rates.weekday) {
            displayRate = formatCurrency(service.rates.weekday);
        } else if (service.rates) { // Fallback if weekday is not set but other rates might be
            const firstRateKey = Object.keys(service.rates)[0];
            displayRate = firstRateKey ? formatCurrency(service.rates[firstRateKey]) : formatCurrency(0);
        }


        row.innerHTML = `
            <td>${service.serviceCode}</td>
            <td>${service.description}</td>
            <td>${(service.categoryType || 'N/A').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
            <td>${displayRate}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="window.editAdminService('${service.id}')"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteAdminService('${service.id}')"><i class="fas fa-trash"></i> Delete</button>
            </td>
        `;
    });
    console.log("[Admin] Services table rendered.");
}

window.editAdminService = (id) => {
    const serviceToEdit = adminManagedServices.find(s => s.id === id);
    if (!serviceToEdit) {
        showMessage("Error", "Service not found for editing.", "error");
        return;
    }
    currentAdminServiceEditingId = id; // Set editing ID

    if(adminServiceIdInputElement) adminServiceIdInputElement.value = serviceToEdit.id; // Usually hidden or read-only
    if(adminServiceCodeInputElement) adminServiceCodeInputElement.value = serviceToEdit.serviceCode || '';
    if(adminServiceDescriptionInputElement) adminServiceDescriptionInputElement.value = serviceToEdit.description || '';
    if(adminServiceCategoryTypeSelectElement) adminServiceCategoryTypeSelectElement.value = serviceToEdit.categoryType || '';

    renderAdminServiceRateFields(); // Render appropriate rate fields for the category

    // Populate rate fields
    if (serviceToEdit.rates) {
        if (serviceToEdit.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM || serviceToEdit.categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
            const flatRateInput = $("#adminServiceRate_flat");
            if (flatRateInput) flatRateInput.value = serviceToEdit.rates.flat || '';
        } else {
            RATE_CATEGORIES.forEach(category => {
                const rateInput = $(`#adminServiceRate_${category}`);
                if (rateInput) rateInput.value = serviceToEdit.rates[category] || '';
            });
        }
    }
    // Populate travel code if applicable
    if (serviceToEdit.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM && serviceToEdit.travelCode) {
        if(adminServiceTravelCodeInputElement) adminServiceTravelCodeInputElement.value = serviceToEdit.travelCode; // Store ID
        const travelService = adminManagedServices.find(s => s.id === serviceToEdit.travelCode);
        if(adminServiceTravelCodeDisplayElement && travelService) adminServiceTravelCodeDisplayElement.textContent = `${travelService.description} (${travelService.serviceCode})`;
        else if(adminServiceTravelCodeDisplayElement) adminServiceTravelCodeDisplayElement.textContent = 'Selected: ' + serviceToEdit.travelCode;
    } else {
        if(adminServiceTravelCodeInputElement) adminServiceTravelCodeInputElement.value = '';
        if(adminServiceTravelCodeDisplayElement) adminServiceTravelCodeDisplayElement.textContent = 'No travel code selected.';
    }


    if(saveAdminServiceButtonElement) saveAdminServiceButtonElement.textContent = 'Update Service';
    adminServiceDescriptionInputElement.focus(); // Focus on a main field
    console.log("[Admin] Editing service:", id);
};

window.deleteAdminService = (id) => {
    // Replace with a proper modal confirmation
    if (confirm(`Are you sure you want to delete this service? This action cannot be undone and may affect existing invoices or agreements if not handled carefully.`)) {
        _confirmDeleteServiceFirestore(id);
    }
};

window._confirmDeleteServiceFirestore = async (id) => {
    if (!fsDb || !userProfile.isAdmin) {
        showMessage("Error", "Not authorized or system error.", "error");
        return;
    }
    showLoading("Deleting service...");
    try {
        // Path to service document: artifacts/{appId}/public/services/{id} (6 segments - correct)
        await deleteDoc(doc(fsDb, `artifacts/${appId}/public/services`, id));
        // Update local cache
        adminManagedServices = adminManagedServices.filter(s => s.id !== id);
        renderAdminServicesTable(); // Refresh table
        clearAdminServiceForm(); // Clear form if the deleted service was being edited
        showMessage("Service Deleted", "The service has been successfully deleted.", "success");
        console.log("[Admin] Service deleted:", id);
    } catch (error) {
        console.error("Error deleting service:", error);
        logErrorToFirestore("_confirmDeleteServiceFirestore", error.message, { serviceId: id });
        showMessage("Delete Failed", "Could not delete service. " + error.message, "error");
    } finally {
        hideLoading();
    }
};

async function saveAdminServiceToFirestore() {
    if (!fsDb || !userProfile.isAdmin) {
        showMessage("Error", "Not authorized or system error.", "error");
        return;
    }

    const serviceData = {
        serviceCode: adminServiceCodeInputElement.value.trim(),
        description: adminServiceDescriptionInputElement.value.trim(),
        categoryType: adminServiceCategoryTypeSelectElement.value,
        rates: {},
        travelCode: null // For travel services, this will link to another service ID
    };

    if (!serviceData.serviceCode || !serviceData.description || !serviceData.categoryType) {
        showMessage("Validation Error", "Please fill in Service Code, Description, and Category Type.", "warning");
        return;
    }

    // Collect rates
    if (serviceData.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM || serviceData.categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
        const flatRateInput = $("#adminServiceRate_flat");
        if (flatRateInput && flatRateInput.value) {
            serviceData.rates.flat = parseFloat(flatRateInput.value);
        } else {
             showMessage("Validation Error", "Please enter a rate for the service.", "warning"); return;
        }
        if (serviceData.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) {
            serviceData.travelCode = adminServiceTravelCodeInputElement.value || null; // Get linked travel code ID
        }
    } else {
        let ratesEntered = false;
        RATE_CATEGORIES.forEach(category => {
            const rateInput = $(`#adminServiceRate_${category}`);
            if (rateInput && rateInput.value) {
                serviceData.rates[category] = parseFloat(rateInput.value);
                ratesEntered = true;
            } else {
                serviceData.rates[category] = 0; // Default to 0 if not entered
            }
        });
        if (!ratesEntered) {
            // showMessage("Validation Error", "Please enter at least one rate for the selected category.", "warning"); return;
            // Allow saving with zero rates, admin can update later
        }
    }

    showLoading(currentAdminServiceEditingId ? "Updating service..." : "Saving new service...");
    try {
        if (currentAdminServiceEditingId) { // Update existing
            const serviceRef = doc(fsDb, `artifacts/${appId}/public/services`, currentAdminServiceEditingId);
            await updateDoc(serviceRef, { ...serviceData, updatedAt: serverTimestamp() });
            // Update local cache
            const index = adminManagedServices.findIndex(s => s.id === currentAdminServiceEditingId);
            if (index > -1) adminManagedServices[index] = { id: currentAdminServiceEditingId, ...serviceData };
            showMessage("Service Updated", "Service details have been updated.", "success");
            console.log("[Admin] Service updated:", currentAdminServiceEditingId);
        } else { // Create new
            const servicesCollectionRef = collection(fsDb, `artifacts/${appId}/public/services`);
            const newServiceRef = await fsAddDoc(servicesCollectionRef, { ...serviceData, createdAt: serverTimestamp() });
            // Add to local cache with new ID
            adminManagedServices.push({ id: newServiceRef.id, ...serviceData });
            showMessage("Service Saved", "New service has been added.", "success");
            console.log("[Admin] New service saved with ID:", newServiceRef.id);
        }
        renderAdminServicesTable(); // Refresh table
        clearAdminServiceForm();    // Clear form
    } catch (error) {
        console.error("Error saving service:", error);
        logErrorToFirestore("saveAdminServiceToFirestore", error.message, { serviceData, editingId: currentAdminServiceEditingId });
        showMessage("Save Failed", "Could not save service. " + error.message, "error");
    } finally {
        hideLoading();
    }
}

function openTravelCodeSelectionModal() {
    if (!travelCodeSelectionModalElement || !travelCodeListContainerElement) return;
    console.log("[Admin] Opening travel code selection modal.");

    // Filter to only show services of type TRAVEL_KM that are NOT the current service being edited (if any)
    const travelServices = adminManagedServices.filter(s =>
        s.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM && s.id !== currentAdminServiceEditingId
    );

    travelCodeListContainerElement.innerHTML = ''; // Clear previous list
    if (travelServices.length === 0) {
        travelCodeListContainerElement.innerHTML = '<p>No suitable travel code services found. Please create a TRAVEL_KM service first.</p>';
    } else {
        travelServices.forEach(service => {
            const div = document.createElement('div');
            div.classList.add('travel-code-option');
            div.innerHTML = `
                <input type="radio" name="travelCodeSelection" id="tc_${service.id}" value="${service.id}" data-description="${service.description} (${service.serviceCode})">
                <label for="tc_${service.id}">${service.description} (${service.serviceCode}) - Rate: ${formatCurrency(service.rates.flat)}/km</label>
            `;
            travelCodeListContainerElement.appendChild(div);
        });
    }
    openModal('travelCodeSelectionModal');

    // Event listener for confirm button (should only be added once or managed)
    confirmTravelCodeSelectionButtonElement.onclick = () => { // Use .onclick for simplicity here
        const selectedRadio = travelCodeListContainerElement.querySelector('input[name="travelCodeSelection"]:checked');
        if (selectedRadio) {
            if(adminServiceTravelCodeInputElement) adminServiceTravelCodeInputElement.value = selectedRadio.value;
            if(adminServiceTravelCodeDisplayElement) adminServiceTravelCodeDisplayElement.textContent = `Selected: ${selectedRadio.dataset.description}`;
            closeModal('travelCodeSelectionModal');
        } else {
            showMessage("Selection Required", "Please select a travel code service.", "warning");
        }
    };
}

function renderAdminAgreementCustomizationTab() {
    if (!agreementCustomData || !adminAgreementOverallTitleInputElement || !adminAgreementClausesContainerElement || !adminAgreementPreviewElement) {
        console.warn("[Admin] Cannot render agreement customization: Missing elements or data.");
        return;
    }
    console.log("[Admin] Rendering Agreement Customization Tab.");

    // Use global `agreementCustomData` which should be loaded with `globalSettings`
    adminAgreementOverallTitleInputElement.value = agreementCustomData.overallTitle || defaultAgreementCustomData.overallTitle;
    renderAdminAgreementClausesEditor();
    updateAdminAgreementPreview();
}

function renderAdminAgreementClausesEditor() {
    if (!adminAgreementClausesContainerElement || !agreementCustomData) return;
    adminAgreementClausesContainerElement.innerHTML = ''; // Clear existing

    (agreementCustomData.clauses || defaultAgreementCustomData.clauses).forEach((clause, index) => {
        const clauseEditorDiv = document.createElement('div');
        clauseEditorDiv.classList.add('agreement-clause-editor');
        clauseEditorDiv.dataset.clauseId = clause.id || `custom_${index}`; // Use existing ID or generate one

        clauseEditorDiv.innerHTML = `
            <h4>Clause: ${clause.heading || `Clause ${index + 1}`}</h4>
            <div class="form-group">
                <label>Heading:</label>
                <input type="text" class="form-input clause-heading-input" value="${clause.heading || ''}">
            </div>
            <div class="form-group">
                <label>Body (Use {{placeholder}} for dynamic content, **bold text** for bold):</label>
                <textarea class="form-input clause-body-textarea" rows="5">${clause.body || ''}</textarea>
            </div>
            <button class="btn btn-danger btn-sm remove-clause-btn" data-index="${index}">&times; Remove Clause</button>
            <hr>
        `;
        adminAgreementClausesContainerElement.appendChild(clauseEditorDiv);
    });

    // Add event listeners for dynamic updates and removal
    adminAgreementClausesContainerElement.querySelectorAll('.clause-heading-input, .clause-body-textarea').forEach(input => {
        input.addEventListener('input', updateAdminAgreementPreview); // Update preview on any change
    });
    adminAgreementClausesContainerElement.querySelectorAll('.remove-clause-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const clauseIndexToRemove = parseInt(e.target.dataset.index, 10);
            if (!isNaN(clauseIndexToRemove) && agreementCustomData.clauses && agreementCustomData.clauses[clauseIndexToRemove]) {
                agreementCustomData.clauses.splice(clauseIndexToRemove, 1);
                renderAdminAgreementClausesEditor(); // Re-render editor
                updateAdminAgreementPreview();     // Update preview
            }
        });
    });
}

function addAdminAgreementClauseEditor() {
    if (!agreementCustomData) agreementCustomData = JSON.parse(JSON.stringify(defaultAgreementCustomData)); // Initialize if empty
    if (!agreementCustomData.clauses) agreementCustomData.clauses = [];

    const newClauseId = `new_clause_${Date.now()}`;
    agreementCustomData.clauses.push({
        id: newClauseId,
        heading: "New Clause Heading",
        body: "New clause body content. Use {{placeholders}}."
    });
    renderAdminAgreementClausesEditor(); // Re-render the editor section
    updateAdminAgreementPreview();     // Update the preview
    // Scroll to the new clause editor
    const newEditor = adminAgreementClausesContainerElement.querySelector(`[data-clause-id="${newClauseId}"]`);
    if (newEditor) newEditor.scrollIntoView({ behavior: 'smooth' });
}

function updateAdminAgreementPreview() {
    if (!adminAgreementPreviewElement || !adminAgreementOverallTitleInputElement) return;

    // Temporarily collect data from editor fields to update `agreementCustomData` for preview
    const previewAgreementData = {
        overallTitle: adminAgreementOverallTitleInputElement.value,
        clauses: []
    };
    adminAgreementClausesContainerElement.querySelectorAll('.agreement-clause-editor').forEach(editorDiv => {
        const headingInput = editorDiv.querySelector('.clause-heading-input');
        const bodyTextarea = editorDiv.querySelector('.clause-body-textarea');
        if (headingInput && bodyTextarea) {
            previewAgreementData.clauses.push({
                id: editorDiv.dataset.clauseId,
                heading: headingInput.value,
                body: bodyTextarea.value
            });
        }
    });


    // Simulate rendering the agreement with dummy worker and settings for preview
    const dummyWorker = { name: "Support Worker Name", abn: "Worker ABN", authorizedServices: [{id: "sample", description:"Sample Service", serviceCode:"S001"}] };
    const dummySettings = {
        defaultParticipantName: "Participant Name", defaultParticipantNdisNo: "000000000",
        defaultPlanEndDate: new Date().toISOString().split('T')[0], // Today for preview
        defaultPlanManagerName: "Plan Manager Name", defaultPlanManagerEmail: "pm@example.com"
    };
    const dummyAgreementState = { createdAt: new Date() }; // For {{agreementStartDate}}

    // Store original agreementContentContainerElement and its dynamic title
    const originalContentContainer = agreementContentContainerElement;
    const originalDynamicTitle = agreementDynamicTitleElement;

    // Temporarily assign preview element to be used by renderAgreementClauses
    window.agreementContentContainerElement = adminAgreementPreviewElement; // Use global var used by render func
    window.agreementDynamicTitleElement = null; // Don't update main page title during preview

    // Use the previewAgreementData for rendering
    const originalCustomData = agreementCustomData; // Backup
    agreementCustomData = previewAgreementData;     // Use temp data for preview

    renderAgreementClauses(dummyWorker, dummySettings, dummyAgreementState);

    // Restore original elements and data
    window.agreementContentContainerElement = originalContentContainer;
    window.agreementDynamicTitleElement = originalDynamicTitle;
    agreementCustomData = originalCustomData; // Restore

    console.log("[Admin] Agreement preview updated.");
}


async function saveAdminAgreementCustomizationsToFirestore() {
    if (!userProfile.isAdmin || !globalSettings || !adminAgreementOverallTitleInputElement) {
        showMessage("Error", "Not authorized or data not loaded.", "error");
        return;
    }
    showLoading("Saving agreement template...");

    // Collect the final customized data from the editor fields
    const finalCustomizedAgreement = {
        overallTitle: adminAgreementOverallTitleInputElement.value.trim(),
        clauses: []
    };

    adminAgreementClausesContainerElement.querySelectorAll('.agreement-clause-editor').forEach(editorDiv => {
        const headingInput = editorDiv.querySelector('.clause-heading-input');
        const bodyTextarea = editorDiv.querySelector('.clause-body-textarea');
        if (headingInput && bodyTextarea) {
            finalCustomizedAgreement.clauses.push({
                id: editorDiv.dataset.clauseId, // Preserve original ID or generated one
                heading: headingInput.value.trim(),
                body: bodyTextarea.value.trim()
            });
        }
    });

    // Update the global `agreementCustomData` and then save it within `globalSettings`
    agreementCustomData = finalCustomizedAgreement;
    globalSettings.agreementTemplate = JSON.parse(JSON.stringify(agreementCustomData)); // Deep copy

    const success = await saveGlobalSettingsToFirestore(); // This will save the entire globalSettings object
    hideLoading();
    if (success) {
        showMessage("Template Saved", "Service agreement template has been updated.", "success");
    } else {
        showMessage("Save Failed", "Could not save agreement template.", "error");
        // If save failed, consider reloading globalSettings to revert changes to agreementCustomData
        await loadGlobalSettingsFromFirestore();
        renderAdminAgreementCustomizationTab(); // Re-render with (potentially) reverted data
    }
}

function renderAdminWorkerManagementTab() {
    console.log("[Admin] Rendering Worker Management Tab.");
    loadPendingApprovalWorkers();
    loadApprovedWorkersForAuthManagement();
    // Clear selection details
    if(selectedWorkerNameForAuthElement) selectedWorkerNameForAuthElement.textContent = "No worker selected.";
    if(servicesForWorkerContainerElement) servicesForWorkerContainerElement.style.display = 'none';
    if(servicesListCheckboxesElement) servicesListCheckboxesElement.innerHTML = '';
    selectedWorkerEmailForAuth = null;
}

async function loadPendingApprovalWorkers() {
    if (!pendingWorkersListElement || !noPendingWorkersMessageElement || !allUsersCache) return;
    pendingWorkersListElement.innerHTML = ''; // Clear list
    const pendingUsers = Object.values(allUsersCache).filter(u => !u.isAdmin && !u.approved);

    if (pendingUsers.length === 0) {
        noPendingWorkersMessageElement.style.display = 'block';
        pendingWorkersListElement.style.display = 'none';
    } else {
        noPendingWorkersMessageElement.style.display = 'none';
        pendingWorkersListElement.style.display = 'block';
        pendingUsers.forEach(user => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${user.name} (${user.email}) - Registered: ${formatDateForDisplay(user.createdAt)}</span>
                <div>
                    <button class="btn btn-sm btn-success" onclick="window.approveWorkerInFirestore('${user.uid}')">Approve</button>
                    <button class="btn btn-sm btn-danger" onclick="window.denyWorkerInFirestore('${user.uid}')">Deny & Delete</button>
                </div>
            `;
            pendingWorkersListElement.appendChild(li);
        });
    }
    console.log("[Admin] Pending approval workers list updated.");
}

window.approveWorkerInFirestore = async (uid) => {
    if (!fsDb || !userProfile.isAdmin) { showMessage("Error", "Not authorized.", "error"); return; }
    showLoading("Approving worker...");
    try {
        const workerProfileRef = doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details");
        await updateDoc(workerProfileRef, { approved: true, approvedAt: serverTimestamp() });

        // Update local cache
        const workerInCache = Object.values(allUsersCache).find(u => u.uid === uid);
        if (workerInCache) workerInCache.approved = true;

        showMessage("Worker Approved", "The worker has been approved and can now log in.", "success");
        loadPendingApprovalWorkers(); // Refresh pending list
        loadApprovedWorkersForAuthManagement(); // Refresh approved list for auth
    } catch (error) {
        console.error("Error approving worker:", error);
        logErrorToFirestore("approveWorkerInFirestore", error.message, { workerUid: uid });
        showMessage("Approval Failed", "Could not approve worker. " + error.message, "error");
    } finally {
        hideLoading();
    }
};

window.denyWorkerInFirestore = async (uid) => {
    // This is a destructive action. Consider if just marking as 'denied' is better than full deletion.
    // For full deletion, you'd also need to delete their Auth user record (requires Admin SDK or callable function).
    // Here, we'll just delete their Firestore profile data. The user won't be able to log in if their profile is gone.
    if (!fsDb || !userProfile.isAdmin) { showMessage("Error", "Not authorized.", "error"); return; }

    if (!confirm("Are you sure you want to deny and delete this worker's registration data? This worker will not be able to use the portal.")) return;

    showLoading("Denying worker...");
    try {
        // Delete profile document and containing folder (more complex, usually just doc)
        const workerProfileRef = doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details");
        await deleteDoc(workerProfileRef);
        // Potentially delete the parent user doc: doc(fsDb, `artifacts/${appId}/users`, uid) if it's just a container.
        // For now, just deleting the profile details.

        // Remove from local cache
        const workerEmailToDelete = Object.keys(allUsersCache).find(email => allUsersCache[email].uid === uid);
        if (workerEmailToDelete) delete allUsersCache[workerEmailToDelete];


        showMessage("Worker Denied", "The worker's registration has been denied and their data removed.", "success");
        loadPendingApprovalWorkers(); // Refresh pending list
        // Note: Auth user still exists. Manual deletion in Firebase console needed for that.
    } catch (error) {
        console.error("Error denying worker:", error);
        logErrorToFirestore("denyWorkerInFirestore", error.message, { workerUid: uid });
        showMessage("Denial Failed", "Could not deny worker. " + error.message, "error");
    } finally {
        hideLoading();
    }
};

async function loadApprovedWorkersForAuthManagement() {
    if (!workersListForAuthElement || !allUsersCache) return;
    workersListForAuthElement.innerHTML = ''; // Clear list

    const approvedWorkers = Object.values(allUsersCache).filter(u => !u.isAdmin && u.approved);

    if (approvedWorkers.length === 0) {
        workersListForAuthElement.innerHTML = '<p>No approved workers found to manage authorizations.</p>';
    } else {
        approvedWorkers.forEach(worker => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${worker.name} (${worker.email})</span>
                <button class="btn btn-sm btn-secondary" onclick="window.selectWorkerForAuth('${worker.uid}', '${worker.name}', '${worker.email}')">Manage Services</button>
            `;
            workersListForAuthElement.appendChild(li);
        });
    }
    console.log("[Admin] Approved workers list for auth management updated.");
}

window.selectWorkerForAuth = (uid, name, email) => {
    if (!selectedWorkerNameForAuthElement || !servicesForWorkerContainerElement || !servicesListCheckboxesElement || !adminManagedServices) return;

    selectedWorkerEmailForAuth = email; // Store email of worker being edited
    selectedWorkerNameForAuthElement.textContent = `Managing services for: ${name} (${email})`;
    servicesForWorkerContainerElement.style.display = 'block';
    servicesListCheckboxesElement.innerHTML = ''; // Clear previous checkboxes

    const workerProfile = allUsersCache[email]; // Get their current profile from cache
    const authorizedServicesForWorker = workerProfile ? workerProfile.authorizedServices || [] : [];

    if (adminManagedServices.length === 0) {
        servicesListCheckboxesElement.innerHTML = '<p>No services have been defined by the admin yet.</p>';
        return;
    }

    adminManagedServices.forEach(service => {
        // Don't list TRAVEL_KM services as directly authorizable here, they are linked via other services.
        if (service.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) return;

        const div = document.createElement('div');
        div.classList.add('checkbox-group');
        const isChecked = authorizedServicesForWorker.includes(service.id);
        div.innerHTML = `
            <input type="checkbox" id="auth_serv_${service.id}" value="${service.id}" ${isChecked ? 'checked' : ''}>
            <label for="auth_serv_${service.id}">${service.description} (${service.serviceCode})</label>
        `;
        servicesListCheckboxesElement.appendChild(div);
    });
};

async function saveWorkerAuthorizationsToFirestore() {
    if (!fsDb || !userProfile.isAdmin || !selectedWorkerEmailForAuth || !servicesListCheckboxesElement) {
        showMessage("Error", "No worker selected or system error.", "error");
        return;
    }

    const workerToUpdate = allUsersCache[selectedWorkerEmailForAuth];
    if (!workerToUpdate) {
        showMessage("Error", "Could not find worker profile to update.", "error");
        logErrorToFirestore("saveWorkerAuthorizations", "Worker profile not found in cache", { email: selectedWorkerEmailForAuth });
        return;
    }

    const selectedServiceIds = [];
    servicesListCheckboxesElement.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
        selectedServiceIds.push(checkbox.value);
    });

    showLoading("Saving authorizations...");
    try {
        const workerProfileRef = doc(fsDb, `artifacts/${appId}/users/${workerToUpdate.uid}/profile`, "details");
        await updateDoc(workerProfileRef, {
            authorizedServices: selectedServiceIds,
            updatedAt: serverTimestamp()
        });

        // Update local cache
        workerToUpdate.authorizedServices = selectedServiceIds;

        showMessage("Authorizations Saved", `Service authorizations for ${workerToUpdate.name} have been updated.`, "success");
        console.log("[Admin] Worker authorizations saved for:", selectedWorkerEmailForAuth);
        // Optionally clear selection or refresh part of the UI
        if(servicesForWorkerContainerElement) servicesForWorkerContainerElement.style.display = 'none';
        if(selectedWorkerNameForAuthElement) selectedWorkerNameForAuthElement.textContent = 'No worker selected.';
        selectedWorkerEmailForAuth = null;

    } catch (error) {
        console.error("Error saving worker authorizations:", error);
        logErrorToFirestore("saveWorkerAuthorizationsToFirestore", error.message, { workerEmail: selectedWorkerEmailForAuth, serviceIds: selectedServiceIds });
        showMessage("Save Failed", "Could not save authorizations. " + error.message, "error");
    } finally {
        hideLoading();
    }
}


/* ========== Modal & Wizard Functions ========== */
function openUserSetupWizard() {
    if (!userSetupWizardModalElement || !userProfile) return;
    console.log("[Wizard] Opening User Setup Wizard.");
    currentUserWizardStep = 1;
    navigateWizard('user', 1); // Navigate to the first step

    // Pre-fill from profile if available (e.g., if wizard was interrupted)
    if(wizardNameInputElement) wizardNameInputElement.value = userProfile.name || '';
    if(wizardAbnInputElement) wizardAbnInputElement.value = userProfile.abn || '';
    if(wizardGstCheckboxElement) wizardGstCheckboxElement.checked = userProfile.gstRegistered || false;
    if(wizardBsbInputElement) wizardBsbInputElement.value = userProfile.bsb || '';
    if(wizardAccInputElement) wizardAccInputElement.value = userProfile.acc || '';
    // File list would need more complex pre-fill if resuming uploads

    openModal('wiz');
}

function openAdminSetupWizard() {
    if (!adminSetupWizardModalElement || !globalSettings) return;
    console.log("[Wizard] Opening Admin Setup Wizard.");
    currentAdminWizardStep = 1;
    navigateWizard('admin', 1); // Navigate to the first step

    // Pre-fill from globalSettings
    if(adminWizardPortalTypeRadioElements) {
        adminWizardPortalTypeRadioElements.forEach(radio => {
            radio.checked = (radio.value === globalSettings.portalType);
        });
    }
    if(adminWizardOrgNameInputElement) adminWizardOrgNameInputElement.value = globalSettings.organizationName || '';
    if(adminWizardOrgAbnInputElement) adminWizardOrgAbnInputElement.value = globalSettings.organizationAbn || '';
    if(adminWizardOrgContactEmailInputElement) adminWizardOrgContactEmailInputElement.value = globalSettings.organizationContactEmail || '';
    if(adminWizardOrgContactPhoneInputElement) adminWizardOrgContactPhoneInputElement.value = globalSettings.organizationContactPhone || '';
    // Admin user's name (might be different from org contact)
    if(adminWizardUserNameInputElement) adminWizardUserNameInputElement.value = userProfile.name || ''; // Admin's own name

    if(adminWizardParticipantNameInputElement) adminWizardParticipantNameInputElement.value = globalSettings.defaultParticipantName || '';
    if(adminWizardParticipantNdisNoInputElement) adminWizardParticipantNdisNoInputElement.value = globalSettings.defaultParticipantNdisNo || '';
    if(adminWizardPlanManagerNameInputElement) adminWizardPlanManagerNameInputElement.value = globalSettings.defaultPlanManagerName || '';
    if(adminWizardPlanManagerEmailInputElement) adminWizardPlanManagerEmailInputElement.value = globalSettings.defaultPlanManagerEmail || '';
    if(adminWizardPlanManagerPhoneInputElement) adminWizardPlanManagerPhoneInputElement.value = globalSettings.defaultPlanManagerPhone || '';
    if(adminWizardPlanEndDateInputElement) adminWizardPlanEndDateInputElement.value = globalSettings.defaultPlanEndDate ? formatDateForInput(new Date(globalSettings.defaultPlanEndDate)) : '';


    openModal('adminSetupWizard');
}

function navigateWizard(type, step) {
    let steps, indicators, currentStepVar;
    if (type === 'user') {
        steps = userWizardStepElements; indicators = userWizardIndicatorElements; currentStepVar = 'currentUserWizardStep';
        window[currentStepVar] = step; // Update global current step for user wizard
    } else if (type === 'admin') {
        steps = adminWizardStepElements; indicators = adminWizardIndicatorElements; currentStepVar = 'currentAdminWizardStep';
        window[currentStepVar] = step; // Update global current step for admin wizard
    } else { return; }

    steps.forEach((s, i) => s.style.display = (i + 1 === step) ? 'block' : 'none');
    indicators.forEach((ind, i) => {
        ind.classList.toggle('active', i + 1 === step);
        ind.classList.toggle('completed', i + 1 < step);
    });
    console.log(`[Wizard] Navigated to ${type} wizard step ${step}.`);
}

function wizardNext(type) {
    let totalSteps, currentStepVar;
    if (type === 'user') { totalSteps = userWizardStepElements.length; currentStepVar = 'currentUserWizardStep'; }
    else if (type === 'admin') { totalSteps = adminWizardStepElements.length; currentStepVar = 'currentAdminWizardStep'; }
    else { return; }

    // Add validation logic for current step before proceeding
    // Example for user wizard step 1:
    if (type === 'user' && window[currentStepVar] === 1) {
        if (!wizardNameInputElement.value.trim()) {
            showMessage("Validation Error", "Please enter your name.", "warning"); return;
        }
    }
    // Add more validation for other steps and admin wizard as needed

    if (window[currentStepVar] < totalSteps) {
        window[currentStepVar]++;
        navigateWizard(type, window[currentStepVar]);
    }
}

function wizardPrev(type) {
    let currentStepVar;
    if (type === 'user') { currentStepVar = 'currentUserWizardStep'; }
    else if (type === 'admin') { currentStepVar = 'currentAdminWizardStep'; }
    else { return; }

    if (window[currentStepVar] > 1) {
        window[currentStepVar]--;
        navigateWizard(type, window[currentStepVar]);
    }
}

async function finishUserWizard() {
    if (!userProfile || !currentUserId) {
        showMessage("Error", "User profile not loaded. Cannot finish setup.", "error"); return;
    }
    // Validation for the last step (e.g., file uploads if mandatory)
    if (globalSettings.requireDocumentUploads && wizardFileUploads.length === 0 && currentUserWizardStep === 3) { // Assuming step 3 is files
         // showMessage("Validation Error", "Please upload required documents or skip if not applicable.", "warning");
         // return; // Or allow skipping if uploads are optional
    }


    showLoading("Finalizing setup...");
    const profileUpdates = {
        name: wizardNameInputElement.value.trim(),
        abn: wizardAbnInputElement.value.trim(),
        gstRegistered: wizardGstCheckboxElement.checked,
        bsb: wizardBsbInputElement.value.trim(),
        acc: wizardAccInputElement.value.trim(),
        // bankName, accountName might be other fields
        profileSetupComplete: true, // Mark setup as complete
        // uploadedFiles: arrayUnion(...wizardFileUploads) // Add uploaded files. This needs careful handling of serverTimestamp.
                                                        // It's better to upload files directly in their step.
    };

    // If wizardFileUploads contains metadata from uploads within the wizard, merge them.
    // This assumes wizardFileUploads are new files not yet in userProfile.uploadedFiles.
    if (wizardFileUploads.length > 0) {
        profileUpdates.uploadedFiles = arrayUnion(...wizardFileUploads.map(f => ({...f, uploadedAt: serverTimestamp()})));
    }


    const success = await saveProfileDetails(profileUpdates); // Use existing save function
    hideLoading();
    if (success) {
        closeModal('wiz');
        showMessage("Setup Complete", "Your profile setup is complete!", "success");
        // userProfile is updated within saveProfileDetails, UI should reflect changes.
        // Re-render relevant parts of the main UI if necessary, e.g., profile display.
        renderProfileSection(); // Or just updateProfileDisplay()
        if (!userProfile.nextInvoiceNumber) openModal('setInitialInvoiceModal'); // Prompt for invoice # if not set
    } else {
        showMessage("Error", "Could not finalize your setup. Please try again.", "error");
        // Keep wizard open or handle error appropriately
        // Revert profileSetupComplete if save failed?
        await saveProfileDetails({ profileSetupComplete: false }); // Mark as incomplete again
    }
    wizardFileUploads = []; // Clear wizard uploads
}

async function finishAdminWizard() {
    if (!globalSettings || !userProfile || !userProfile.isAdmin) {
        showMessage("Error", "Settings not loaded or not authorized.", "error"); return;
    }
    // Validation for the last step of admin wizard
    if (!adminWizardParticipantNameInputElement.value.trim() && currentAdminWizardStep === 3) { // Assuming step 3 is participant details
        showMessage("Validation Error", "Please enter default participant details.", "warning"); return;
    }

    showLoading("Finalizing admin setup...");

    // Collect all settings from wizard fields and update globalSettings object
    const selectedPortalTypeRadio = $$("input[name='adminWizPortalType']:checked")[0];
    globalSettings.portalType = selectedPortalTypeRadio ? selectedPortalTypeRadio.value : globalSettings.portalType;

    globalSettings.organizationName = adminWizardOrgNameInputElement.value.trim();
    globalSettings.organizationAbn = adminWizardOrgAbnInputElement.value.trim();
    globalSettings.organizationContactEmail = adminWizardOrgContactEmailInputElement.value.trim();
    globalSettings.organizationContactPhone = adminWizardOrgContactPhoneInputElement.value.trim();

    // Update admin's own name in their profile if changed in wizard
    const adminNameFromWizard = adminWizardUserNameInputElement.value.trim();
    if (adminNameFromWizard && adminNameFromWizard !== userProfile.name) {
        await saveProfileDetails({ name: adminNameFromWizard }); // Update admin's own profile
        userProfile.name = adminNameFromWizard; // Update local cache
    }

    globalSettings.defaultParticipantName = adminWizardParticipantNameInputElement.value.trim();
    globalSettings.defaultParticipantNdisNo = adminWizardParticipantNdisNoInputElement.value.trim();
    globalSettings.defaultPlanManagerName = adminWizardPlanManagerNameInputElement.value.trim();
    globalSettings.defaultPlanManagerEmail = adminWizardPlanManagerEmailInputElement.value.trim();
    globalSettings.defaultPlanManagerPhone = adminWizardPlanManagerPhoneInputElement.value.trim();
    globalSettings.defaultPlanEndDate = adminWizardPlanEndDateInputElement.value;

    globalSettings.setupComplete = true; // Mark admin setup as complete

    const success = await saveGlobalSettingsToFirestore(); // Save updated globalSettings
    hideLoading();
    if (success) {
        closeModal('adminSetupWizard');
        showMessage("Admin Setup Complete", "Portal initial setup is complete!", "success");
        renderAdminGlobalSettingsTab(); // Refresh the main admin settings tab with new values
        updatePortalTitle(); // Update title based on new settings
    } else {
        showMessage("Error", "Could not finalize admin setup. Please try again.", "error");
        await saveGlobalSettingsToFirestore({setupComplete: false}); // Mark as incomplete again
    }
}


// Custom Time Picker Logic (Simplified)
function openCustomTimePicker(inputElementRef, onTimeSetCallback) {
    if (!customTimePickerElement || !inputElementRef) return;
    activeTimeInput = inputElementRef; // Store the input element that triggered the picker
    timePickerCallback = onTimeSetCallback; // Store the callback

    // Initialize picker (e.g., to current input value or a default)
    const currentTime = activeTimeInput.value || "09:00"; // Default to 09:00
    const [hr, min] = currentTime.split(':').map(Number);
    selectedHour12 = hr % 12 || 12;
    selectedAmPm = hr >= 12 ? 'PM' : 'AM';
    selectedMinute = Math.floor(min / 15) * 15; // Snap to nearest 15 min

    currentTimePickerStep = 'hours'; // Start with hour selection
    renderTimePickerStep();
    openModal('customTimePicker');
}

function renderTimePickerStep() {
    if (!currentTimePickerStepLabelElement || !timePickerHoursContainerElement || !timePickerMinutesContainerElement || !timePickerAmPmButtonsContainerElement || !timePickerBackButtonElement) return;

    timePickerHoursContainerElement.style.display = 'none';
    timePickerMinutesContainerElement.style.display = 'none';
    timePickerAmPmButtonsContainerElement.style.display = 'none';
    timePickerBackButtonElement.style.display = 'none';

    let currentSelectionDisplay = "";

    if (currentTimePickerStep === 'hours') {
        currentTimePickerStepLabelElement.textContent = "Select Hour";
        timePickerHoursContainerElement.style.display = 'grid'; // Assuming grid layout for hours
        timePickerHoursContainerElement.innerHTML = ''; // Clear
        for (let i = 1; i <= 12; i++) {
            const hourBtn = document.createElement('button');
            hourBtn.textContent = i;
            hourBtn.classList.add('time-picker-btn', 'hour-btn');
            if (i === selectedHour12) hourBtn.classList.add('selected');
            hourBtn.onclick = () => { selectedHour12 = i; currentTimePickerStep = 'ampm'; renderTimePickerStep(); };
            timePickerHoursContainerElement.appendChild(hourBtn);
        }
        currentSelectionDisplay = `${selectedHour12}:XX ${selectedAmPm}`;
    } else if (currentTimePickerStep === 'ampm') {
        currentTimePickerStepLabelElement.textContent = "Select AM/PM";
        timePickerAmPmButtonsContainerElement.style.display = 'flex';
        timePickerBackButtonElement.style.display = 'inline-block';
        // AM/PM buttons setup (assuming they exist in HTML or are created here)
        // Example:
        $("#timePickerAMBtn").onclick = () => { selectedAmPm = 'AM'; currentTimePickerStep = 'minutes'; renderTimePickerStep(); };
        $("#timePickerPMBtn").onclick = () => { selectedAmPm = 'PM'; currentTimePickerStep = 'minutes'; renderTimePickerStep(); };
        currentSelectionDisplay = `${selectedHour12}:XX ${selectedAmPm}`;

    } else if (currentTimePickerStep === 'minutes') {
        currentTimePickerStepLabelElement.textContent = `Select Minute (${selectedHour12}:XX ${selectedAmPm})`;
        timePickerMinutesContainerElement.style.display = 'grid'; // Assuming grid for minutes
        timePickerBackButtonElement.style.display = 'inline-block';
        timePickerMinutesContainerElement.innerHTML = ''; // Clear
        for (let i = 0; i < 60; i += 15) { // 15-minute intervals
            const minBtn = document.createElement('button');
            minBtn.textContent = String(i).padStart(2, '0');
            minBtn.classList.add('time-picker-btn', 'minute-btn');
            if (i === selectedMinute) minBtn.classList.add('selected');
            minBtn.onclick = () => { selectedMinute = i; /* Update display, enable Set button */ renderTimePickerStep(); }; // Re-render to update selection
            timePickerMinutesContainerElement.appendChild(minBtn);
        }
        currentSelectionDisplay = `${selectedHour12}:${String(selectedMinute).padStart(2, '0')} ${selectedAmPm}`;
    }
    // Update a display element within the picker if you have one for current selection
    // e.g., $("#currentTimeDisplayInPicker").textContent = currentSelectionDisplay;
}

setTimeButtonElement?.addEventListener('click', () => {
    if (activeTimeInput && typeof selectedHour12 !== 'undefined' && typeof selectedMinute !== 'undefined' && selectedAmPm) {
        let finalHour24 = selectedHour12;
        if (selectedAmPm === 'PM' && selectedHour12 !== 12) finalHour24 += 12;
        if (selectedAmPm === 'AM' && selectedHour12 === 12) finalHour24 = 0; // Midnight case

        const timeString = `${String(finalHour24).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
        activeTimeInput.value = timeString;
        if (timePickerCallback) timePickerCallback(timeString); // Call callback if provided
        closeModal('customTimePicker');
    } else {
        showMessage("Time Error", "Please complete time selection.", "warning");
    }
});

timePickerBackButtonElement?.addEventListener('click', () => {
    if (currentTimePickerStep === 'minutes') currentTimePickerStep = 'ampm';
    else if (currentTimePickerStep === 'ampm') currentTimePickerStep = 'hours';
    renderTimePickerStep();
});


/* ========== Event Listeners Setup ========== */
function setupEventListeners() {
    // Auth
    loginButtonElement?.addEventListener('click', modalLogin);
    registerButtonElement?.addEventListener('click', modalRegister);
    logoutButtonElement?.addEventListener('click', portalSignOut);
    authPasswordInputElement?.addEventListener('keypress', e => { if (e.key === 'Enter') modalLogin(); });

    // Navigation
    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => {
        if (a) { // Ensure 'a' is not null
            a.addEventListener('click', e => {
                e.preventDefault();
                if (a.hash) { // Ensure 'a.hash' is defined
                    navigateToSection(a.hash.substring(1));
                } else {
                    console.warn("Navigation link missing hash:", a);
                }
            });
        }
    });


    // Profile
    editProfileButtonElement?.addEventListener('click', () => openUserSetupWizard()); // Re-use wizard for editing
    uploadProfileDocumentsButtonElement?.addEventListener('click', uploadProfileDocuments);
    // Note: Delete document confirmation is handled by inline onclick, but could be delegated here.

    // Invoice
    addInvoiceRowButtonElement?.addEventListener('click', addInvRowUserAction);
    saveDraftButtonElement?.addEventListener('click', saveInvoiceDraft);
    generateInvoicePdfButtonElement?.addEventListener('click', generateInvoicePdf);
    saveInitialInvoiceNumberButtonElement?.addEventListener('click', saveInitialInvoiceNumber);
    if(invoiceDateInputElement && invoiceWeekLabelElement) {
        invoiceDateInputElement.addEventListener('change', () => {
            invoiceWeekLabelElement.textContent = getWeekNumber(new Date(invoiceDateInputElement.value));
        });
    }


    // Agreement
    signAgreementButtonElement?.addEventListener('click', () => openSignatureModal('worker'));
    participantSignButtonElement?.addEventListener('click', () => openSignatureModal('participant')); // Admin signs as participant
    downloadAgreementPdfButtonElement?.addEventListener('click', generateAgreementPdf);
    saveSignatureButtonElement?.addEventListener('click', saveSignature);
    closeSignatureModalButtonElement?.addEventListener('click', () => closeModal('sigModal'));
    clearSignaturePadButton?.addEventListener('click', clearSignaturePad); // Assuming ID: clearSignaturePadButton

    loadServiceAgreementForSelectedWorkerButtonElement?.addEventListener('click', () => {
        if (adminSelectWorkerForAgreementElement && adminSelectWorkerForAgreementElement.value) {
            currentAgreementWorkerEmail = adminSelectWorkerForAgreementElement.value;
            loadAndRenderServiceAgreement(currentAgreementWorkerEmail);
        } else {
            showMessage("Selection Missing", "Please select a worker to load their agreement.", "warning");
        }
    });

    // Admin Tabs
    adminNavTabButtons.forEach(btn => btn.addEventListener('click', () => switchAdminTab(btn.dataset.target)));

    // Admin Global Settings
    saveAdminPortalSettingsButtonElement?.addEventListener('click', saveAdminPortalSettings);
    resetGlobalSettingsToDefaultsButtonElement?.addEventListener('click', window.confirmResetGlobalSettings);
    copyInviteLinkButtonElement?.addEventListener('click', () => {
        if (inviteLinkCodeElement && inviteLinkCodeElement.textContent) {
            navigator.clipboard.writeText(inviteLinkCodeElement.textContent)
                .then(() => showMessage("Copied!", "Invite link copied to clipboard.", "success"))
                .catch(err => {
                    console.error("Failed to copy invite link:", err);
                    showMessage("Copy Failed", "Could not copy link. Check browser permissions.", "error");
                });
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
    // Preview updates on input in renderAdminAgreementClausesEditor

    // Admin Worker Management
    saveWorkerAuthorizationsButtonElement?.addEventListener('click', saveWorkerAuthorizationsToFirestore);

    // Modals & Wizards Common Close Buttons
    $$(".modal .close-modal-btn").forEach(btn => { // Generic close button for modals
        const modal = btn.closest('.modal');
        if (modal) btn.addEventListener('click', () => closeModal(modal.id));
    });

    // Request Shift Modal (Example - needs implementation)
    requestShiftButtonElement?.addEventListener('click', () => openModal('rqModal'));
    closeRequestModalButtonElement?.addEventListener('click', () => closeModal('rqModal'));
    saveRequestButtonElement?.addEventListener('click', () => { /* Add save shift request logic */ closeModal('rqModal'); });

    // Log Shift Modal (Example - needs implementation)
    logTodayShiftButtonElement?.addEventListener('click', () => openModal('logShiftModal'));
    closeLogShiftModalButtonElement?.addEventListener('click', () => closeModal('logShiftModal'));
    saveShiftToInvoiceButtonElement?.addEventListener('click', () => { /* Add save shift to invoice logic */ closeModal('logShiftModal'); });

    // Message Modal
    closeMessageModalButtonElement?.addEventListener('click', () => closeModal('messageModal'));

    // User Setup Wizard Navigation
    wizardNextButton1Element?.addEventListener('click', () => wizardNext('user'));
    wizardNextButton2Element?.addEventListener('click', () => wizardNext('user'));
    wizardNextButton3Element?.addEventListener('click', () => wizardNext('user')); // Assuming step 3 is files
    wizardPrevButton2Element?.addEventListener('click', () => wizardPrev('user'));
    wizardPrevButton3Element?.addEventListener('click', () => wizardPrev('user'));
    wizardPrevButton4Element?.addEventListener('click', () => wizardPrev('user')); // Back from summary to files
    wizardFinishButtonElement?.addEventListener('click', finishUserWizard);
    // Handle file uploads in user wizard step 3
    wizardFilesInputElement?.addEventListener('change', (e) => {
        if (!wizardFilesListElement) return;
        wizardFilesListElement.innerHTML = ''; // Clear previous list
        wizardFileUploads = Array.from(e.target.files); // Store File objects
        if (wizardFileUploads.length > 0) {
            wizardFileUploads.forEach(file => {
                const li = document.createElement('li');
                li.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                wizardFilesListElement.appendChild(li);
            });
        } else {
            wizardFilesListElement.innerHTML = '<li>No files selected.</li>';
        }
    });


    // Admin Setup Wizard Navigation
    adminWizardNextButton1Element?.addEventListener('click', () => wizardNext('admin'));
    adminWizardNextButton2Element?.addEventListener('click', () => wizardNext('admin'));
    // adminWizardNextButton3Element?.addEventListener('click', () => wizardNext('admin')); // If more steps
    adminWizardPrevButton2Element?.addEventListener('click', () => wizardPrev('admin'));
    adminWizardPrevButton3Element?.addEventListener('click', () => wizardPrev('admin'));
    adminWizardFinishButtonElement?.addEventListener('click', finishAdminWizard);


    // Time Picker (already handled with direct .onclick or specific listeners)
    // cancelTimeButtonElement, setTimeButtonElement, timePickerBackButtonElement handled above

    // Other global listeners or initializations
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash || '#home'; // Default to #home if no hash
        navigateToSection(hash.substring(1));
    });

    // Close modals on ESC key
    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape") {
            $$('.modal').forEach(modal => {
                if (modal.style.display === 'flex') {
                    closeModal(modal.id);
                }
            });
        }
    });

    console.log("[Events] All primary event listeners set up.");
}

/* ========== App Initialization ========== */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed. App Version 1.1.0"); // Update version as needed
    showLoading("Initializing Portal...");

    await initializeFirebaseApp(); // This now awaits setupAuthListener internally

    // setupAuthListener is now called and awaited within initializeFirebaseApp
    // So, by the time initializeFirebaseApp resolves, the first auth state is known.

    setupEventListeners(); // Setup other event listeners after Firebase is ready

    // Initial navigation based on hash or default
    // Wait for initialAuthComplete before navigating to ensure user state is processed
    // This can be tricky if initializeFirebaseApp resolves before onAuthStateChanged fully completes its first run.
    // A better pattern is to let onAuthStateChanged handle initial navigation after auth state is clear.

    // The navigation is now primarily driven by onAuthStateChanged logic (enterPortal, etc.)
    // and the hashchange listener.
    // We might still want to trigger initial hash check if onAuthStateChanged doesn't cover all cases.
    if (initialAuthComplete) { // Check if auth listener has done its initial run
        const initialHash = window.location.hash || '#home';
        navigateToSection(initialHash.substring(1));
    } else {
        // If auth isn't complete yet, onAuthStateChanged will handle the first navigation.
        // We can add a timeout or a flag that onAuthStateChanged sets, then check here.
        // For now, relying on onAuthStateChanged.
        console.log("Waiting for onAuthStateChanged to handle initial navigation.");
    }


    // Hide loading should ideally happen after the first meaningful paint/content is ready.
    // Since onAuthStateChanged handles showing/hiding content, it also handles hideLoading().
    // If initializeFirebaseApp fails early, it also calls hideLoading().
    // So, this final hideLoading() might be redundant or could be removed if auth flow always handles it.
    // For safety, keeping it here, but it might flicker if auth takes time.
    if (loadingOverlayElement.style.display !== "none") { // Only hide if still visible
        // hideLoading();
        // Let onAuthStateChanged be the primary controller of the loading overlay during auth.
    }
    console.log("[AppInit] DOMContentLoaded complete. App should be interactive or in auth flow.");
});

// Make sure clearSignaturePad is globally accessible if called by HTML onclick
window.clearSignaturePad = clearSignaturePad;

// NOTE: Many function bodies (like `renderProfileFilesList`, `saveProfileDetails`, etc.)
// are marked as `/* ... Implementation ... */`. These need to be filled out with
// the actual application logic based on the full requirements.
// This structure provides the framework and connects the UI elements.
