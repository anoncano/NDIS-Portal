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
// Main Screens & Overlays
const authScreenElement = $("#authScreen"), portalAppElement = $("#portalApp"), loadingOverlayElement = $("#loadingOverlay");
// Auth Form
const authEmailInputElement = $("#authEmail"), authPasswordInputElement = $("#authPassword"), authStatusMessageElement = $("#authStatusMessage");
const loginButtonElement = $("#loginBtn"), registerButtonElement = $("#registerBtn"), logoutButtonElement = $("#logoutBtn");
// Portal Common
const userIdDisplayElement = $("#userIdDisplay"), portalTitleDisplayElement = $("#portalTitleDisplay");
const sideNavLinks = $$("nav#side a.link"), bottomNavLinks = $$("nav#bottom a.bLink"), adminTabElement = $("#adminTab");
// Home Section
const homeUserDivElement = $("#homeUser"), userNameDisplayElement = $("#userNameDisplay"), requestShiftButtonElement = $("#rqBtn"), logTodayShiftButtonElement = $("#logTodayShiftBtn");
const shiftRequestsTableBodyElement = $("#rqTbl tbody");
// Profile Section
const profileNameElement = $("#profileName"), profileAbnElement = $("#profileAbn"), profileGstElement = $("#profileGst"), profileBsbElement = $("#profileBsb"), profileAccElement = $("#profileAcc");
const profileFilesListElement = $("#profileFilesList"), profileFileUploadElement = $("#profileFileUpload"), uploadProfileDocumentsButtonElement = $("#uploadProfileDocumentsBtn"), editProfileButtonElement = $("#editProfileBtn");
// Invoice Section
const setInitialInvoiceModalElement = $("#setInitialInvoiceModal"), initialInvoiceNumberInputElement = $("#initialInvoiceNumberInput"), saveInitialInvoiceNumberButtonElement = $("#saveInitialInvoiceNumberBtn");
const invoiceWeekLabelElement = $("#wkLbl"), invoiceNumberInputElement = $("#invNo"), invoiceDateInputElement = $("#invDate");
const providerNameInputElement = $("#provName"), providerAbnInputElement = $("#provAbn"), gstFlagInputElement = $("#gstFlag");
const invoiceTableBodyElement = $("#invTbl tbody"), subtotalElement = $("#sub"), gstRowElement = $("#gstRow"), gstAmountElement = $("#gst"), grandTotalElement = $("#grand");
const addInvoiceRowButtonElement = $("#addInvRowUserActionBtn"), saveDraftButtonElement = $("#saveDraftBtn"), generateInvoicePdfButtonElement = $("#generateInvoicePdfBtn"), invoicePdfContentElement = $("#invoicePdfContent");
// Agreement Section
const agreementDynamicTitleElement = $("#agreementDynamicTitle"), adminAgreementWorkerSelectorElement = $("#adminAgreementWorkerSelector"), adminSelectWorkerForAgreementElement = $("#adminSelectWorkerForAgreement"), loadServiceAgreementForSelectedWorkerButtonElement = $("#loadServiceAgreementForSelectedWorkerBtn");
const agreementChipElement = $("#agrChip"), agreementContentContainerElement = $("#agreementContentContainer"), participantSignatureImageElement = $("#sigP"), participantSignatureDateElement = $("#dP");
const workerSignatureImageElement = $("#sigW"), workerSignatureDateElement = $("#dW"), signAgreementButtonElement = $("#signBtn"), participantSignButtonElement = $("#participantSignBtn"), downloadAgreementPdfButtonElement = $("#pdfBtn"), agreementContentWrapperElement = $("#agreementContentWrapper"), agreementHeaderForPdfElement = $("#agreementHeaderForPdf");
// Admin Tabs & Panels
const adminNavTabButtons = $$(".admin-tab-btn"), adminContentPanels = $$(".admin-content-panel");
// Admin Global Settings
const adminEditOrgNameInputElement = $("#adminEditOrgName"), adminEditOrgAbnInputElement = $("#adminEditOrgAbn"), adminEditOrgContactEmailInputElement = $("#adminEditOrgContactEmail"), adminEditOrgContactPhoneInputElement = $("#adminEditOrgContactPhone");
const adminEditParticipantNameInputElement = $("#adminEditParticipantName"), adminEditParticipantNdisNoInputElement = $("#adminEditParticipantNdisNo"), adminEditPlanManagerNameInputElement = $("#adminEditPlanManagerName"), adminEditPlanManagerEmailInputElement = $("#adminEditPlanManagerEmail"), adminEditPlanManagerPhoneInputElement = $("#adminEditPlanManagerPhone"), adminEditPlanEndDateInputElement = $("#adminEditPlanEndDate");
const saveAdminPortalSettingsButtonElement = $("#saveAdminPortalSettingsBtn"), resetGlobalSettingsToDefaultsButtonElement = $("#resetGlobalSettingsToDefaultsBtn"), inviteLinkCodeElement = $("#invite"), copyInviteLinkButtonElement = $("#copyLinkBtn");
// Admin Service Management
const adminServiceIdInputElement = $("#adminServiceId"), adminServiceCodeInputElement = $("#adminServiceCode"), adminServiceDescriptionInputElement = $("#adminServiceDescription"), adminServiceCategoryTypeSelectElement = $("#adminServiceCategoryType");
const adminServiceRateFieldsContainerElement = $("#adminServiceRateFieldsContainer"), adminServiceTravelCodeDisplayElement = $("#adminServiceTravelCodeDisplay"), selectTravelCodeButtonElement = $("#selectTravelCodeBtn"), adminServiceTravelCodeInputElement = $("#adminServiceTravelCode");
const saveAdminServiceButtonElement = $("#saveAdminServiceBtn"), clearAdminServiceFormButtonElement = $("#clearAdminServiceFormBtn"), adminServicesTableBodyElement = $("#adminServicesTable tbody");
// Admin Agreement Customization
const adminAgreementOverallTitleInputElement = $("#adminAgreementOverallTitle"), adminAgreementClausesContainerElement = $("#adminAgreementClausesContainer"), adminAddAgreementClauseButtonElement = $("#adminAddAgreementClauseBtn"), saveAdminAgreementCustomizationsButtonElement = $("#saveAdminAgreementCustomizationsBtn"), adminAgreementPreviewElement = $("#adminAgreementPreview");
// Admin Worker Management
const pendingWorkersListElement = $("#pendingWorkersList"), noPendingWorkersMessageElement = $("#noPendingWorkersMessage"), workersListForAuthElement = $("#workersListForAuth"), selectedWorkerNameForAuthElement = $("#selectedWorkerNameForAuth"), servicesForWorkerContainerElement = $("#servicesForWorkerContainer"), servicesListCheckboxesElement = $("#servicesListCheckboxes"), saveWorkerAuthorizationsButtonElement = $("#saveWorkerAuthorizationsBtn");
// Modals: Request Shift, Log Shift, Signature
const requestShiftModalElement = $("#rqModal"), requestDateInputElement = $("#rqDate"), requestStartTimeInputElement = $("#rqStart"), requestEndTimeInputElement = $("#rqEnd"), requestReasonTextareaElement = $("#rqReason"), saveRequestButtonElement = $("#saveRequestBtn"), closeRequestModalButtonElement = $("#closeRqModalBtn");
const logShiftModalElement = $("#logShiftModal"), logShiftDateInputElement = $("#logShiftDate"), logShiftSupportTypeSelectElement = $("#logShiftSupportType"), logShiftStartTimeInputElement = $("#logShiftStartTime"), logShiftEndTimeInputElement = $("#logShiftEndTime"), logShiftClaimTravelToggleElement = $("#logShiftClaimTravelToggle"), logShiftKmFieldsContainerElement = $("#logShiftKmFieldsContainer"), logShiftStartKmInputElement = $("#logShiftStartKm"), logShiftEndKmInputElement = $("#logShiftEndKm"), logShiftCalculatedKmElement = $("#logShiftCalculatedKm"), saveShiftToInvoiceButtonElement = $("#saveShiftFromModalToInvoiceBtn"), closeLogShiftModalButtonElement = $("#closeLogShiftModalBtn");
const signatureModalElement = $("#sigModal"), signatureCanvasElement = $("#signatureCanvas"), saveSignatureButtonElement = $("#saveSigBtn"), clearSignatureButtonElement = $("#clearSigBtn"), closeSignatureModalButtonElement = $("#closeSigModalBtn");
// Modals: User Setup Wizard
const userSetupWizardModalElement = $("#wiz"), userWizardStepElements = $$("#wiz .wizard-step-content"), userWizardIndicatorElements = $$("#wiz .wizard-step-indicator");
const wizardNameInputElement = $("#wName"), wizardAbnInputElement = $("#wAbn"), wizardGstCheckboxElement = $("#wGst"), wizardNextButton1Element = $("#wizNextBtn1");
const wizardBsbInputElement = $("#wBsb"), wizardAccInputElement = $("#wAcc"), wizardPrevButton2Element = $("#wizPrevBtn2"), wizardNextButton2Element = $("#wizNextBtn2");
const wizardFilesInputElement = $("#wFiles"), wizardFilesListElement = $("#wFilesList"), wizardPrevButton3Element = $("#wizPrevBtn3"), wizardNextButton3Element = $("#wizNextBtn3");
const wizardPrevButton4Element = $("#wizPrevBtn4"), wizardFinishButtonElement = $("#wizFinishBtn");
// Modals: Admin Setup Wizard
const adminSetupWizardModalElement = $("#adminSetupWizard"), adminWizardStepElements = $$("#adminSetupWizard .wizard-step-content"), adminWizardIndicatorElements = $$("#adminSetupWizard .wizard-step-indicator");
const adminWizardPortalTypeRadioElements = $$("input[name='adminWizPortalType']"), adminWizardNextButton1Element = $("#adminWizNextBtn1");
const adminWizardOrgNameInputElement = $("#adminWizOrgName"), adminWizardOrgAbnInputElement = $("#adminWizOrgAbn"), adminWizardOrgContactEmailInputElement = $("#adminWizOrgContactEmail"), adminWizardOrgContactPhoneInputElement = $("#adminWizOrgContactPhone");
const adminWizardUserNameInputElement = $("#adminWizUserName"), adminWizardPrevButton2Element = $("#adminWizPrevBtn2"), adminWizardNextButton2Element = $("#adminWizNextBtn2");
const adminWizardParticipantNameInputElement = $("#adminWizParticipantName"), adminWizardParticipantNdisNoInputElement = $("#adminWizParticipantNdisNo"), adminWizardPlanManagerNameInputElement = $("#adminWizPlanManagerName"), adminWizardPlanManagerEmailInputElement = $("#adminWizPlanManagerEmail"), adminWizardPlanManagerPhoneInputElement = $("#adminWizPlanManagerPhone"), adminWizardPlanEndDateInputElement = $("#adminWizPlanEndDate");
const adminWizardPrevButton3Element = $("#adminWizPrevBtn3"), adminWizardFinishButtonElement = $("#adminWizFinishBtn");
// Modals: Custom Time Picker, Message, Confirmation, Travel Code Selection
const customTimePickerElement = $("#customTimePicker"), timePickerAmPmButtonsContainerElement = $("#timePickerAmPmButtons"), timePickerHoursContainerElement = $("#timePickerHours"), timePickerMinutesContainerElement = $("#timePickerMinutes"), timePickerBackButtonElement = $("#timePickerBackButton"), setTimeButtonElement = $("#setTimeButton"), cancelTimeButtonElement = $("#cancelTimeButton"), currentTimePickerStepLabelElement = $("#currentTimePickerStepLabel");
const messageModalElement = $("#messageModal"), messageModalTitleElement = $("#messageModalTitle"), messageModalTextElement = $("#messageModalText"), closeMessageModalButtonElement = $("#closeMessageModalBtn");
const confirmationModalElement = $("#confirmationModal"), confirmationModalTitleElement = $("#confirmationModalTitle"), confirmationModalTextElement = $("#confirmationModalText"), confirmationModalConfirmBtnElement = $("#confirmationModalConfirmBtn"), confirmationModalCancelBtnElement = $("#confirmationModalCancelBtn");
const travelCodeSelectionModalElement = $("#travelCodeSelectionModal"), travelCodeFilterInputElement = $("#travelCodeFilterInput"), travelCodeListContainerElement = $("#travelCodeListContainer"), confirmTravelCodeSelectionButtonElement = $("#confirmTravelCodeSelectionBtn"), closeTravelCodeSelectionModalButtonElement = $("#closeTravelCodeSelectionModalBtn");

/* ========== Local State Variables ========== */
let userProfile = {};
let globalSettings = {};
let adminManagedServices = []; // Stores all NDIS services defined by admin
let currentInvoiceData = { items: [], invoiceNumber: "", invoiceDate: "", subtotal: 0, gst: 0, grandTotal: 0 };
let agreementCustomData = {}; // Stores the structure/template of the service agreement
let defaultAgreementCustomData = { // Default structure if none is in Firestore
    overallTitle: "NDIS Service Agreement",
    clauses: [
        { id: "parties", heading: "1. Parties", body: "This Service Agreement is between:\n\n**The Participant:** {{participantName}} (NDIS No: {{participantNdisNo}}, Plan End Date: {{planEndDate}})\n\nand\n\n**The Provider (Support Worker):** {{workerName}} (ABN: {{workerAbn}})" },
        { id: "purpose", heading: "2. Purpose", body: "Outlines supports {{workerName}} provides to {{participantName}}." },
        { id: "services", heading: "3. Agreed Supports", body: "{{serviceList}}" }, // Placeholder for list of services
        { id: "provider_resp", heading: "4. Provider Responsibilities", body: "Deliver safe, respectful, professional services." },
        { id: "participant_resp", heading: "5. Participant Responsibilities", body: "Treat provider with respect, provide safe environment." },
        { id: "payments", heading: "6. Payments", body: "Invoices issued to {{planManagerName}} ({{planManagerEmail}}). Terms: 14 days." },
        { id: "cancellations", heading: "7. Cancellations", body: "24 hours' notice required." },
        { id: "feedback", heading: "8. Feedback", body: "Contact {{workerName}} first." },
        { id: "term", heading: "9. Term", body: "Starts {{agreementStartDate}}, ends {{agreementEndDate}} or plan end. Reviewed annually." }
    ]
};
const RATE_CATEGORIES = ["weekday", "evening", "night", "saturday", "sunday", "public"]; // For NDIS service rates
const SERVICE_CATEGORY_TYPES = { CORE_STANDARD: 'core_standard', CORE_HIGH_INTENSITY: 'core_high_intensity', CAPACITY_THERAPY_STD: 'capacity_therapy_std', CAPACITY_SPECIALIST: 'capacity_specialist', TRAVEL_KM: 'travel_km', OTHER_FLAT_RATE: 'other_flat_rate' };
let sigCanvas, sigCtx, sigPen = false, sigPaths = []; // Signature pad variables
let currentAgreementWorkerEmail = null; // Tracks whose agreement is being viewed/signed
let signingAs = 'worker'; // 'worker' or 'participant' for signature modal context
let isFirebaseInitialized = false, initialAuthComplete = false; // Firebase & Auth status flags
let selectedWorkerEmailForAuth = null; // For admin managing worker service authorizations
let currentAdminServiceEditingId = null; // Tracks which NDIS service is being edited by admin
let currentTimePickerStep, selectedMinute, selectedHour12, selectedAmPm, activeTimeInput, timePickerCallback; // Custom time picker state
let currentAdminWizardStep = 1, currentUserWizardStep = 1; // Wizard step trackers
let wizardFileUploads = []; // Files staged for upload in wizards
let allUsersCache = {}; // Cache for admin to quickly look up user details
let currentOnConfirmCallback = null; // For the generic confirmation modal

/* ========== Error Logging ========== */
// Logs errors to Firestore for debugging and monitoring
async function logErrorToFirestore(location, errorMsg, errorDetails = {}) {
    if (!fsDb || !appId || appId === 'ndis-portal-app-local') { console.error("Firestore not init/local dev, no log:", location, errorMsg, errorDetails); return; }
    try {
        await fsAddDoc(collection(fsDb, `artifacts/${appId}/public/logs/errors`), {
            location: String(location), errorMessage: String(errorMsg),
            errorStack: errorDetails instanceof Error ? errorDetails.stack : JSON.stringify(errorDetails),
            user: currentUserEmail || currentUserId || "unknown", timestamp: serverTimestamp(),
            appVersion: "1.1.1", userAgent: navigator.userAgent, url: window.location.href
        });
        console.info("Error logged to Firestore:", location);
    } catch (logError) { console.error("FATAL: Could not log error to Firestore:", logError, "Original error:", location, errorMsg); }
}

/* ========== UI Helpers ========== */
// Shows a loading overlay
function showLoading(message = "Loading...") { if (loadingOverlayElement) { loadingOverlayElement.querySelector('p').textContent = message; loadingOverlayElement.style.display = "flex"; } }
// Hides the loading overlay
function hideLoading() { if (loadingOverlayElement) loadingOverlayElement.style.display = "none"; }
// Displays a status message in the authentication form
function showAuthStatusMessage(message, isError = true) { if (authStatusMessageElement) { authStatusMessageElement.textContent = message; authStatusMessageElement.style.color = isError ? 'var(--danger)' : 'var(--ok)'; authStatusMessageElement.style.display = message ? 'block' : 'none'; } }
// Shows a generic message modal (like an alert)
function showMessage(title, text, type = 'info') {
    const iconClass = type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
    if (messageModalTitleElement) messageModalTitleElement.innerHTML = `<i class="fas ${iconClass}"></i> ${title}`;
    if (messageModalTextElement) messageModalTextElement.innerHTML = text; // Use innerHTML to allow simple HTML like <br>
    if (messageModalElement) messageModalElement.style.display = "flex";
}
// Shows a generic confirmation modal
function showConfirmationModal(title, text, onConfirm) {
    if (confirmationModalTitleElement) confirmationModalTitleElement.innerHTML = `<i class="fas fa-question-circle"></i> ${title}`;
    if (confirmationModalTextElement) confirmationModalTextElement.textContent = text;
    currentOnConfirmCallback = onConfirm; // Store the callback function
    if (confirmationModalElement) confirmationModalElement.style.display = "flex";
}
// Opens a modal by its ID
function openModal(modalId) { const modal = $(`#${modalId}`); if (modal) modal.style.display = 'flex'; }
// Closes a modal by its ID
function closeModal(modalId) { const modal = $(`#${modalId}`); if (modal) modal.style.display = 'none'; }

// Updates the portal title in the browser tab and side navigation
function updatePortalTitle() {
    const title = globalSettings.portalTitle || "NDIS Support Portal";
    if (portalTitleDisplayElement && globalSettings.portalTitle) {
        portalTitleDisplayElement.innerHTML = `<i class="fas fa-cogs"></i> ${globalSettings.portalTitle}`;
    } else if (portalTitleDisplayElement) {
        portalTitleDisplayElement.innerHTML = `<i class="fas fa-cogs"></i> NDIS Support Portal`; // Fallback title
    }
    document.title = title;
    console.log(`[UI] Portal title updated to: ${title}`);
}


/* ========== Utilities ========== */
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase()); }
function formatDateForDisplay(d) { if (!d) return ""; try { const date = d.toDate ? d.toDate() : new Date(d); return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { console.warn("formatDateForDisplay error:", e); return "Invalid Date"; } }
function formatDateForInput(d) { if (!d) return ""; try { const date = d.toDate ? d.toDate() : new Date(d); const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), day = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; } catch (e) { console.warn("formatDateForInput error:", e); return ""; } }
function timeToMinutes(t) { if (!t || !t.includes(':')) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function calculateHours(s, e) { if (!s || !e) return 0; const diff = timeToMinutes(e) - timeToMinutes(s); return diff > 0 ? parseFloat((diff / 60).toFixed(2)) : 0; }
function determineRateType(dStr, sTime) { if (!dStr || !sTime) return "weekday"; const d = new Date(`${dStr}T${sTime}:00`); const day = d.getDay(), hr = d.getHours(); if (day === 0) return "sunday"; if (day === 6) return "saturday"; if (hr >= 20 || hr < 6) return "night"; /* TODO: Add public holiday check */ return "weekday"; }
function formatTime12Hour(t24) { if (!t24 || !t24.includes(':')) return ""; const [h, m] = t24.split(':'); const hr = parseInt(h, 10); const ap = hr >= 12 ? 'PM' : 'AM'; let hr12 = hr % 12; hr12 = hr12 ? hr12 : 12; return `${String(hr12).padStart(2, '0')}:${m} ${ap}`; }
function formatCurrency(n) { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n || 0); }
function generateUniqueId(prefix = 'id_') { return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 9); }
function getWeekNumber(d) { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); const yS = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil((((d - yS) / 86400000) + 1) / 7); }

/* ========== Firebase Initialization & Auth ========== */
// Initializes Firebase app and services
async function initializeFirebaseApp() {
    console.log("[FirebaseInit] Initializing Firebase...");
    const config = typeof firebaseConfigForApp !== 'undefined' ? firebaseConfigForApp : (typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null);

    if (!config || !config.apiKey || config.apiKey.startsWith("YOUR_")) {
        showAuthStatusMessage("CRITICAL ERROR: Portal configuration is invalid. Firebase API key is missing or is a placeholder. Please contact support or ensure your environment is correctly set up."); hideLoading();
        logErrorToFirestore("initializeFirebaseApp", "Firebase config missing or invalid (API Key issue)", { apiKeyProvided: !!(config && config.apiKey), isPlaceholder: !!(config && config.apiKey && config.apiKey.startsWith("YOUR_")) });
        return;
    }
    try {
        fbApp = initializeApp(config, appId); // appId helps differentiate if multiple apps use same project
        fbAuth = getAuth(fbApp);
        fsDb = getFirestore(fbApp);
        fbStorage = getStorage(fbApp);
        isFirebaseInitialized = true;
        console.log("[FirebaseInit] Firebase initialized successfully.");
        await setupAuthListener(); // Sets up the listener for authentication state changes
    } catch (error) {
        console.error("[FirebaseInit] Firebase initialization error:", error);
        logErrorToFirestore("initializeFirebaseApp", error.message, error);
        showAuthStatusMessage("System Error: Could not initialize Firebase. " + error.message);
        hideLoading();
    }
}

// Sets up the listener for Firebase authentication state changes
async function setupAuthListener() {
    return new Promise((resolve) => {
        onAuthStateChanged(fbAuth, async (user) => {
            showLoading("Authenticating...");
            try {
                if (user) { // User is signed in
                    currentUserId = user.uid; currentUserEmail = user.email;
                    console.log("[AuthListener] User authenticated:", currentUserId, currentUserEmail);
                    if(userIdDisplayElement) userIdDisplayElement.textContent = currentUserEmail || currentUserId;
                    if(logoutButtonElement) logoutButtonElement.classList.remove('hide');
                    if(authScreenElement) authScreenElement.style.display = "none";
                    if(portalAppElement) portalAppElement.style.display = "flex"; // Show main app

                    await loadGlobalSettingsFromFirestore(); // Load portal-wide settings
                    const profileData = await loadUserProfileFromFirestore(currentUserId); // Load specific user's profile
                    let signedOutDueToFlow = false; // Flag if any sub-handler decides to sign out the user

                    console.log(`[AuthListener Decision] Profile data found: ${!!profileData}`);
                    console.log(`[AuthListener Decision] Checking for admin: currentUserEmail='${currentUserEmail}', globalSettings.adminEmail='${globalSettings.adminEmail}'`);

                    if (profileData) { // Existing user profile found
                        console.log("[AuthListener Decision] Path: Existing user profile.");
                        signedOutDueToFlow = await handleExistingUserProfile(profileData);
                    } else if (currentUserEmail && globalSettings.adminEmail && currentUserEmail.toLowerCase() === globalSettings.adminEmail.toLowerCase()) { // New user matches admin email
                        console.log("[AuthListener Decision] Path: New admin profile.");
                        signedOutDueToFlow = await handleNewAdminProfile();
                    } else if (currentUserId) { // New regular user
                        console.log("[AuthListener Decision] Path: New regular user profile.");
                        signedOutDueToFlow = await handleNewRegularUserProfile();
                    } else { // Should not happen if 'user' object is valid
                        console.warn("[AuthListener] User object present but no identifiable path. Signing out for safety.");
                        await fbSignOut(fbAuth);
                        signedOutDueToFlow = true;
                    }

                    if (signedOutDueToFlow) {
                        console.log("[AuthListener] User flow resulted in sign out. UI will revert to auth screen.");
                    }
                } else { // User is signed out
                    console.log("[AuthListener] User signed out or no user session.");
                    currentUserId = null; currentUserEmail = null; userProfile = {}; globalSettings = getDefaultGlobalSettings();
                    if(userIdDisplayElement) userIdDisplayElement.textContent = "Not Logged In";
                    if(logoutButtonElement) logoutButtonElement.classList.add('hide');
                    if(authScreenElement) authScreenElement.style.display = "flex"; // Show auth screen
                    if(portalAppElement) portalAppElement.style.display = "none"; // Hide main app
                    updateNavigation(false); // Reset navigation for logged-out state
                    navigateToSection("home"); // Go to home (which will be the auth screen's context)
                    updatePortalTitle(); // Reset portal title
                }
            } catch (error) {
                console.error("[AuthListener] Critical error during auth state change handling:", error);
                logErrorToFirestore("onAuthStateChanged", error.message, error);
                if (fbAuth) await fbSignOut(fbAuth).catch(e => console.error("Sign out error during auth error handling:", e)); // Attempt to sign out to reset state
            } finally {
                hideLoading();
                if (!initialAuthComplete) {
                    initialAuthComplete = true; // Mark that the first auth check has completed
                    resolve(); // Resolve the promise from setupAuthListener
                }
            }
        });

        // Handle custom token sign-in if provided by the environment (e.g., Canvas)
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            console.log("[AuthListener] Attempting sign-in with custom token from environment.");
            signInWithCustomToken(fbAuth, __initial_auth_token)
                .catch(e => {
                    console.error("Custom token sign-in error:", e);
                    logErrorToFirestore("signInWithCustomToken", e.message, e);
                    // If custom token fails, the onAuthStateChanged will eventually pick up a null user or an anonymous user if that's a fallback.
                });
        } else {
            console.log("[AuthListener] No __initial_auth_token found. Waiting for standard auth state change or user login action.");
        }
    });
}

// Handles logic for an existing user profile
async function handleExistingUserProfile(data) {
    userProfile = { ...data, uid: currentUserId, email: currentUserEmail }; // Sync local profile with auth state

    console.log(`[Auth] Existing profile loaded. Approved: ${userProfile.approved}, Admin: ${userProfile.isAdmin}, Setup Complete: ${userProfile.profileSetupComplete}`);
    console.log("[Auth] Global Settings Portal Type:", globalSettings.portalType);

    // If it's an organization portal and the user is not an admin and not yet approved
    if (!userProfile.isAdmin && globalSettings.portalType === 'organization' && !userProfile.approved) {
        showMessage("Approval Required", "Your account is pending approval from the administrator. You will be logged out.", "warning");
        await fbSignOut(fbAuth);
        return true; // Indicates user was signed out
    }

    // Load data and enter portal based on role
    if (userProfile.isAdmin) {
        await loadAllDataForAdmin();
        enterPortal(true); // Enter as admin
        if (!globalSettings.setupComplete) { // If global portal setup isn't done
            openAdminSetupWizard();
        }
    } else {
        await loadAllDataForUser();
        enterPortal(false); // Enter as regular user
        // If user profile setup isn't complete and it's not an individual participant portal (where setup might be simpler)
        if (!userProfile.profileSetupComplete && globalSettings.portalType !== 'individual_participant') {
             openUserSetupWizard();
        }
    }
    return false; // User remains signed in
}

// Handles logic for a new admin profile
async function handleNewAdminProfile() {
    console.log("[Auth] New admin login detected for:", currentUserEmail);
    userProfile = { // Default structure for a new admin
        isAdmin: true,
        name: "Administrator",
        email: currentUserEmail,
        uid: currentUserId,
        approved: true, // Admins are auto-approved
        createdAt: serverTimestamp(),
        profileSetupComplete: true, // Admin profile setup is considered complete by default
        nextInvoiceNumber: 1001 // Default starting invoice number
    };
    try {
        // Save this new admin profile to Firestore
        await setDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), userProfile);
        console.log("[Auth] New admin profile created in Firestore.");
        await loadAllDataForAdmin(); // Load all necessary admin data
        enterPortal(true); // Enter portal as admin
        if (!globalSettings.setupComplete) { // If global portal setup isn't done
            console.log("[Auth] Global settings not complete, opening admin setup wizard.");
            openAdminSetupWizard();
        }
    } catch (error) {
        console.error("[Auth] Error creating new admin profile:", error);
        logErrorToFirestore("handleNewAdminProfile", error.message, error);
        showMessage("Setup Error", "Could not initialize admin account. Please try again or contact support.", "error");
        await fbSignOut(fbAuth); // Sign out on error
        return true; // Indicates user was signed out
    }
    return false; // User remains signed in
}

// Handles logic for a new regular user profile
async function handleNewRegularUserProfile() {
    console.log("[Auth] New regular user detected:", currentUserEmail);
    const isOrgPortal = globalSettings.portalType === 'organization';
    userProfile = { // Default structure for a new regular user
        name: currentUserEmail.split('@')[0], // Default name from email prefix
        email: currentUserEmail,
        uid: currentUserId,
        isAdmin: false,
        approved: !isOrgPortal, // Auto-approve if not an organization portal, otherwise requires admin approval
        profileSetupComplete: false, // New users need to complete profile setup
        nextInvoiceNumber: 1001, // Default starting invoice number
        createdAt: serverTimestamp(),
        authorizedServices: [] // Initially no specific services authorized
    };

    try {
        // Save this new user profile to Firestore
        await setDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), userProfile);
        console.log("[Auth] New regular user profile created in Firestore.");

        // If it's an organization portal and user is not yet approved
        if (isOrgPortal && !userProfile.approved) {
            showMessage("Registration Complete", "Your account has been created and is awaiting approval from the administrator. You will be logged out.", "info");
            await fbSignOut(fbAuth); // Sign out until approved
            return true; // Indicates user was signed out
        }

        await loadAllDataForUser(); // Load user-specific data
        enterPortal(false); // Enter portal as regular user
        // If user profile setup isn't complete and it's not an individual participant portal
        if (!userProfile.profileSetupComplete && globalSettings.portalType !== 'individual_participant') {
            console.log("[Auth] User profile setup not complete, opening user setup wizard.");
            openUserSetupWizard();
        }
    } catch (error) {
        console.error("[Auth] Error creating new regular user profile:", error);
        logErrorToFirestore("handleNewRegularUserProfile", error.message, error);
        showMessage("Registration Error", "Could not complete your registration. Please try again or contact support.", "error");
        await fbSignOut(fbAuth); // Sign out on error
        return true; // Indicates user was signed out
    }
    return false; // User remains signed in
}


/* ========== Data Loading & Saving ========== */
// Loads a user's profile from Firestore
async function loadUserProfileFromFirestore(uid) {
    if (!fsDb || !uid) {
        console.error("[ProfileLoad] Error: Firestore DB not initialized or UID missing.");
        logErrorToFirestore("loadUserProfileFromFirestore", "DB not init or UID missing", { uidProvided: !!uid, dbInit: !!fsDb });
        return null;
    }
    try {
        const userProfileRef = doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details");
        const snap = await getDoc(userProfileRef);
        if (snap.exists()) {
            const fetchedData = snap.data();
            console.log("[ProfileLoad] User profile loaded from Firestore for UID:", uid);
            return fetchedData;
        } else {
            console.log(`[ProfileLoad] No user profile found in Firestore for UID ${uid} at path artifacts/${appId}/users/${uid}/profile/details`);
            return null; // No profile exists for this user yet
        }
    } catch (e) {
        console.error("[ProfileLoad] Error loading user profile:", e);
        logErrorToFirestore("loadUserProfileFromFirestore", e.message, e);
        return null;
    }
}
// Returns default global settings for the portal
function getDefaultGlobalSettings() {
    return {
        portalTitle: "NDIS Support Portal",
        organizationName: "Your Organization Name",
        organizationAbn: "Your ABN",
        organizationContactEmail: "contact@example.com",
        organizationContactPhone: "000-000-000",
        adminEmail: "admin@portal.com", // IMPORTANT: This should be set by the first admin during setup or deployment
        defaultParticipantName: "Participant Name",
        defaultParticipantNdisNo: "000000000",
        defaultPlanManagerName: "Plan Manager Name",
        defaultPlanManagerEmail: "pm@example.com",
        defaultPlanManagerPhone: "111-111-111",
        defaultPlanEndDate: formatDateForInput(new Date(new Date().setFullYear(new Date().getFullYear() + 1))),
        setupComplete: false, // Tracks if the initial admin setup wizard has been completed
        portalType: "organization", // 'organization' or 'individual_participant'
        agreementTemplate: JSON.parse(JSON.stringify(defaultAgreementCustomData)), // Default agreement structure
        requireDocumentUploads: true, // Example setting
        defaultCurrency: "AUD"
    };
}

// Loads global portal settings from Firestore
async function loadGlobalSettingsFromFirestore() {
    if (!fsDb) { console.warn("Firestore not available for global settings load."); globalSettings = getDefaultGlobalSettings(); updatePortalTitle(); return; }
    try {
        const settingsDocRef = doc(fsDb, 'artifacts', appId, 'public', 'settings');
        const snap = await getDoc(settingsDocRef);
        if (snap.exists()) {
            globalSettings = { ...getDefaultGlobalSettings(), ...snap.data() }; // Merge with defaults to ensure all keys exist
            console.log("[DataLoad] Global settings loaded from Firestore.");
        }
        else { // No settings document found, use defaults and save them
            console.log("[DataLoad] No global settings found. Using defaults and attempting to save.");
            globalSettings = getDefaultGlobalSettings();
            await saveGlobalSettingsToFirestore(true); // Save silently
        }
    } catch (e) {
        console.error("[DataLoad] Error loading global settings:", e);
        logErrorToFirestore("loadGlobalSettingsFromFirestore", e.message, e);
        globalSettings = getDefaultGlobalSettings(); // Fallback to defaults on error
    }
    // Ensure agreementCustomData is populated from globalSettings or defaults
    agreementCustomData = globalSettings.agreementTemplate ? JSON.parse(JSON.stringify(globalSettings.agreementTemplate)) : JSON.parse(JSON.stringify(defaultAgreementCustomData));
    updatePortalTitle(); // Update UI with loaded/default title
}

// Saves global portal settings to Firestore
async function saveGlobalSettingsToFirestore(isSilent = false) {
    if (!fsDb ) {
        console.error("[DataSave] Error: Firestore DB not initialized. Cannot save global settings.");
        logErrorToFirestore("saveGlobalSettingsToFirestore", "Attempted to save global settings without DB init.");
        if (!isSilent) showMessage("Save Error", "System error: Cannot save settings. Firestore not available.", "error");
        return false;
    }

    // Ensure the agreement template in globalSettings is up-to-date with local agreementCustomData
    globalSettings.agreementTemplate = JSON.parse(JSON.stringify(agreementCustomData));
    try {
        const settingsDocRef = doc(fsDb, 'artifacts', appId, 'public', 'settings');
        await setDoc(settingsDocRef, globalSettings, { merge: true }); // Use merge to avoid overwriting fields not managed here
        console.log("[DataSave] Global settings saved to Firestore.");
        updatePortalTitle(); // Update UI
        if (!isSilent) showMessage("Settings Saved", "Global portal settings have been updated.", "success");
        return true;
    }
    catch (e) {
        console.error("[DataSave] Error saving global settings:", e);
        logErrorToFirestore("saveGlobalSettingsToFirestore", e.message, e);
        if (!isSilent) showMessage("Save Error", "Could not save global settings. " + e.message, "error");
        return false;
    }
}

// Renders the user-specific content on the home page
function renderUserHomePage() {
    if (!userProfile || !currentUserId || userProfile.isAdmin) {
        if(homeUserDivElement) homeUserDivElement.style.display = 'none';
        console.log("[Home] renderUserHomePage called but user is admin or profile not loaded. Hiding user home div.");
        return;
    }
    console.log("[Home] Rendering user home page for:", userProfile.name);
    if(homeUserDivElement) homeUserDivElement.style.display = 'block'; // Show the user-specific part of home
    if(userNameDisplayElement && userProfile.name) {
        userNameDisplayElement.textContent = userProfile.name; // Display user's name
    }
    // TODO: Load and display shift requests if any (from rqTbl tbody)
}


// Loads all NDIS services defined by the admin from Firestore
async function loadAdminServicesFromFirestore() {
    adminManagedServices = []; // Clear existing services
    if (!fsDb) { console.error("[DataLoad] Error: Firestore DB not initialized. Cannot load NDIS services."); return; }
    try {
        const servicesCollectionRef = collection(fsDb, `artifacts/${appId}/public/services`);
        const querySnapshot = await getDocs(servicesCollectionRef);
        querySnapshot.forEach(d => adminManagedServices.push({ id: d.id, ...d.data() }));
        console.log("[DataLoad] Admin-managed NDIS services loaded:", adminManagedServices.length);
    } catch (e) {
        console.error("[DataLoad] Error loading NDIS services:", e);
        logErrorToFirestore("loadAdminServicesFromFirestore", e.message, e);
    }
    renderAdminServicesTable(); // Update the UI table for services
    // populateServiceTypeDropdowns(); // This should be called where needed, e.g., when opening log shift modal
}

// Loads all user profiles into a cache for admin use
async function loadAllUsersForAdmin() {
    allUsersCache = {}; // Clear existing cache
    if (!userProfile.isAdmin || !fsDb) {
        console.warn("Cannot load all users: Not admin or Firestore not initialized.");
        return;
    }
    try {
        const usersCollectionRef = collection(fsDb, `artifacts/${appId}/users`); // Path to the parent 'users' collection
        const usersSnapshot = await getDocs(usersCollectionRef);
        const profilePromises = [];

        usersSnapshot.forEach(userDoc => { // userDoc here is the document representing a user's UID
            const uid = userDoc.id;
            // Path to the specific profile document for that user
            const profileRef = doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details");
            profilePromises.push(getDoc(profileRef).catch(e => {
                console.warn(`Failed to get profile for user ${uid}:`, e);
                logErrorToFirestore("loadAllUsersForAdmin_getProfile", `Failed for UID: ${uid}`, e);
                return null; // Return null if a specific profile fails to load
            }));
        });

        const profileSnapshots = await Promise.all(profilePromises);
        profileSnapshots.forEach(profileSnap => {
            if (profileSnap && profileSnap.exists()) {
                const profile = profileSnap.data();
                // Ensure UID is consistently stored, using profile.uid or fallback to snapshot ID (which is the UID)
                allUsersCache[profile.uid || profileSnap.id] = { ...profile, uid: profile.uid || profileSnap.id };
            }
        });
        console.log("[DataLoad] All user profiles cached for admin:", Object.keys(allUsersCache).length);
    } catch (error) {
        console.error("[DataLoad] Error loading all users for admin:", error);
        logErrorToFirestore("loadAllUsersForAdmin", error.message, error);
    }
}


// Placeholder for loading all data specific to a regular user
async function loadAllDataForUser() {
    showLoading("Loading your data...");
    console.log("[DataLoad] Loading user-specific data (e.g., invoice drafts, agreement status).");
    // Example: await loadUserInvoiceDraft(); await loadUserAgreementStatus(); etc.
    // For now, these are called when their respective sections are navigated to.
    hideLoading();
}
// Loads all data required for the admin dashboard
async function loadAllDataForAdmin() {
    showLoading("Loading admin data...");
    await loadAllUsersForAdmin(); // Cache all user profiles
    await loadAdminServicesFromFirestore(); // Load all defined NDIS services
    // Other admin-specific data loads can be triggered when their tabs are opened
    // e.g., loadPendingApprovalWorkers(), loadApprovedWorkersForAuthManagement()
    console.log("[DataLoad] Admin data loading sequence complete.");
    hideLoading();
}

/* ========== Portal Entry & Navigation ========== */
// Main function to enter the portal after successful authentication and data loading
function enterPortal(isAdmin) {
    console.log(`Entering portal. User: ${currentUserEmail}, Admin: ${isAdmin}`);
    if(portalAppElement) portalAppElement.style.display = "flex"; // Show main app flex container
    if(authScreenElement) authScreenElement.style.display = "none"; // Hide auth screen

    updateNavigation(isAdmin); // Configure navigation links based on user role
    updateProfileDisplay(); // Populate profile information if available
    updatePortalTitle(); // Set portal title

    if (isAdmin) {
        navigateToSection("admin"); // Admins default to admin dashboard
        renderAdminDashboard(); // Render the admin dashboard content
    } else {
        navigateToSection("home"); // Regular users default to home screen
        renderUserHomePage(); // Render user-specific home content
        // If user hasn't set their initial invoice number and it's relevant for their portal type
        if (userProfile && !userProfile.nextInvoiceNumber && globalSettings.portalType !== 'individual_participant') {
            openModal('setInitialInvoiceModal');
        }
    }
}

// Updates navigation links visibility based on admin status
function updateNavigation(isAdmin) {
    const linksToShow = ["#home", "#profile", "#invoice", "#agreement"]; // Common links
    if (isAdmin) {
        linksToShow.push("#admin"); // Add admin link if user is admin
        if(adminTabElement) adminTabElement.classList.remove('hide');
    } else {
        if(adminTabElement) adminTabElement.classList.add('hide');
    }

    // Toggle visibility for side and bottom navigation links
    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => {
        if (a && a.hash) {
            a.classList.toggle('hide', !linksToShow.includes(a.hash));
        }
    });
    console.log("[UI] Navigation updated. Admin status:", isAdmin);
}

// Navigates to a specific section of the portal
function navigateToSection(sectionId) {
    if (!sectionId) {
        console.warn("[Navigate] No sectionId provided, defaulting to 'home'.");
        sectionId = 'home';
    }
    // Hide all sections, then show the target one
    $$("main section.card").forEach(s => s.classList.remove("active"));
    const targetSection = $(`#${sectionId}`);
    if (targetSection) {
        targetSection.classList.add("active");
    } else { // Fallback if target section doesn't exist
        console.warn(`[Navigate] Target section '#${sectionId}' not found. Defaulting to home.`);
        $(`#home`)?.classList.add("active");
        sectionId = 'home'; // Update sectionId to reflect the fallback
    }

    // Update active state for navigation links
    $$("nav a").forEach(a => a.classList.remove("active"));
    $$(`nav a[href="#${sectionId}"]`).forEach(a => a.classList.add("active"));

    const mainContentArea = $("main"); // Scroll to top of new section
    if(mainContentArea) mainContentArea.scrollTop = 0;

    console.log(`[Navigate] Navigating to section: #${sectionId}`);
    // Call section-specific rendering functions
    switch (sectionId) {
        case "home":
            if (userProfile && !userProfile.isAdmin) renderUserHomePage();
            else if (userProfile && userProfile.isAdmin) console.log("[Navigate] Admin landed on home, no specific admin home render defined yet.");
            else renderUserHomePage(); // Fallback for non-profile states (e.g. initial load)
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
            else navigateToSection("home"); // Non-admins cannot access admin section
            break;
        default:
            console.warn(`[Navigate] No specific render function for section: #${sectionId}`);
            // Ensure home is active if no specific section logic matched and target wasn't found
            if (!$(`#${sectionId}`)?.classList.contains('active')) {
                 $(`#home`)?.classList.add("active");
                 $$(`nav a[href="#home"]`).forEach(a => a.classList.add("active"));
            }
    }
}


/* ========== Auth Functions ========== */
// Handles user login via email and password
async function modalLogin() {
    const email = authEmailInputElement.value.trim();
    const password = authPasswordInputElement.value;
    if (!validateEmail(email) || !password) { showAuthStatusMessage("Invalid email or password format."); return; }

    showLoading("Logging in..."); showAuthStatusMessage("", false); // Clear previous messages
    try {
        await signInWithEmailAndPassword(fbAuth, email, password);
        console.log("[Auth] Login successful for:", email);
        // onAuthStateChanged will handle UI updates and navigation
    }
    catch (err) {
        console.error("Login Error:", err);
        logErrorToFirestore("modalLogin", err.message, { code: err.code, emailAttempted: email });
        let userMessage = "Login failed. Please check your credentials.";
        // Provide more specific error messages based on Firebase error codes
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            userMessage = "Invalid email or password.";
        } else if (err.code === 'auth/too-many-requests') {
            userMessage = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
        } else if (err.code === 'auth/network-request-failed') {
            userMessage = "Login failed. Please check your internet connection.";
        }
        showAuthStatusMessage(userMessage);
    }
    finally { hideLoading(); }
}

// Handles new user registration via email and password
async function modalRegister() {
    const email = authEmailInputElement.value.trim();
    const password = authPasswordInputElement.value;
    if (!validateEmail(email)) { showAuthStatusMessage("Please enter a valid email address."); return; }
    if (password.length < 6) { showAuthStatusMessage("Password must be at least 6 characters long."); return; }

    showLoading("Registering..."); showAuthStatusMessage("", false); // Clear previous messages
    try {
        await createUserWithEmailAndPassword(fbAuth, email, password);
        console.log("[Auth] Registration successful for:", email);
        // onAuthStateChanged will handle UI updates, profile creation, and navigation
    }
    catch (err) {
        console.error("Register Error:", err);
        logErrorToFirestore("modalRegister", err.message, { code: err.code, emailAttempted: email });
        let userMessage = "Registration failed. Please try again.";
        // Provide more specific error messages
        if (err.code === 'auth/email-already-in-use') {
            userMessage = "This email address is already registered. Please try logging in.";
        } else if (err.code === 'auth/weak-password') {
            userMessage = "The password is too weak. Please choose a stronger password.";
        } else if (err.code === 'auth/network-request-failed') {
            userMessage = "Registration failed. Please check your internet connection.";
        }
        showAuthStatusMessage(userMessage);
    }
    finally { hideLoading(); }
}

// Handles user sign-out
async function portalSignOut() {
    showLoading("Logging out...");
    try {
        await fbSignOut(fbAuth);
        console.log("[Auth] User signed out successfully.");
        // onAuthStateChanged will handle UI reset and navigation to auth screen
    } catch (e) {
        console.error("Sign Out Error:", e);
        logErrorToFirestore("portalSignOut", e.message, e);
        showMessage("Logout Error", "An error occurred while signing out. Please try again.", "error");
    } finally {
        hideLoading();
    }
}

/* ========== Profile Functions ========== */
// Renders the profile section with user's data
function renderProfileSection() {
    if (!userProfile || !currentUserId) {
        console.warn("[Profile] Cannot render profile: User profile not loaded or no current user.");
        if(profileNameElement) profileNameElement.textContent = 'N/A'; // Show N/A if no data
        // Clear other fields or show appropriate messages
        return;
    }
    console.log("[Profile] Rendering profile section for:", userProfile.name);
    updateProfileDisplay(); // Populate fields with userProfile data
}

// Updates the display elements in the profile section
function updateProfileDisplay() {
    if (!userProfile) return; // Exit if no profile data

    if(profileNameElement) profileNameElement.textContent = userProfile.name || 'N/A';
    if(profileAbnElement) profileAbnElement.textContent = userProfile.abn || 'N/A';
    if(profileGstElement) profileGstElement.textContent = userProfile.gstRegistered ? 'Yes' : 'No';
    if(profileBsbElement) profileBsbElement.textContent = userProfile.bsb || 'N/A';
    if(profileAccElement) profileAccElement.textContent = userProfile.acc || 'N/A';

    renderProfileFilesList(); // Update the list of uploaded documents
}
// Renders the list of uploaded files in the profile section
function renderProfileFilesList() {
    if (!profileFilesListElement) return;
    profileFilesListElement.innerHTML = ''; // Clear existing list
    const files = userProfile.uploadedFiles || [];
    if (files.length === 0) {
        profileFilesListElement.innerHTML = '<li>No documents uploaded yet.</li>';
        return;
    }
    files.forEach(file => {
        const li = document.createElement('li');
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-danger btn-sm';
        deleteButton.innerHTML = '<i class="fas fa-trash"></i> Delete';
        deleteButton.onclick = () => requestDeleteProfileDocument(file.name, file.path); // Use new request function

        li.innerHTML = `<a href="${file.url}" target="_blank" rel="noopener noreferrer">${file.name}</a>
                        (Uploaded: ${formatDateForDisplay(file.uploadedAt?.toDate ? file.uploadedAt.toDate() : new Date(file.uploadedAt))}) `;
        li.appendChild(deleteButton);
        profileFilesListElement.appendChild(li);
    });
}
// Saves updated profile details to Firestore
async function saveProfileDetails(updates) {
    if (!fsDb || !currentUserId || !userProfile) {
        console.error("[ProfileSave] Error: Firestore DB not initialized, no user ID, or profile not loaded.");
        showMessage("Error", "Could not save profile. Please try again.", "error");
        logErrorToFirestore("saveProfileDetails", "DB/User/Profile missing", { db:!!fsDb, uid:!!currentUserId, prof:!!userProfile});
        return false;
    }
    showLoading("Saving profile...");
    try {
        const profileRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        await updateDoc(profileRef, { ...updates, updatedAt: serverTimestamp() }); // Add/update fields
        userProfile = { ...userProfile, ...updates }; // Update local profile object
        console.log("[ProfileSave] Profile details updated in Firestore and locally.");
        updateProfileDisplay(); // Refresh UI
        showMessage("Profile Saved", "Your profile details have been updated.", "success");
        return true;
    } catch (error) {
        console.error("[ProfileSave] Error saving profile details:", error);
        logErrorToFirestore("saveProfileDetails", error.message, error);
        showMessage("Save Error", "Could not save your profile. " + error.message, "error");
        return false;
    } finally {
        hideLoading();
    }
}
// Uploads selected documents to Firebase Storage and links them in the user's profile
async function uploadProfileDocuments() {
    if (!fbStorage || !currentUserId || !profileFileUploadElement || !profileFileUploadElement.files || profileFileUploadElement.files.length === 0) {
        showMessage("Upload Error", "Please select a file to upload.", "warning");
        return;
    }
    const filesToUpload = Array.from(profileFileUploadElement.files);
    showLoading(`Uploading ${filesToUpload.length} file(s)...`);

    try {
        const uploadPromises = filesToUpload.map(async (file) => {
            const filePath = `artifacts/${appId}/users/${currentUserId}/profileDocuments/${Date.now()}_${file.name}`; // Unique path
            const fileRef = ref(fbStorage, filePath);
            await uploadBytes(fileRef, file); // Upload the file
            const downloadURL = await getDownloadURL(fileRef); // Get its public URL
            return { name: file.name, url: downloadURL, path: filePath, uploadedAt: serverTimestamp() }; // Metadata to save
        });

        const uploadedFileMetadatas = await Promise.all(uploadPromises); // Wait for all uploads

        const profileRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        // Add new file metadata to the 'uploadedFiles' array in Firestore profile
        await updateDoc(profileRef, {
            uploadedFiles: arrayUnion(...uploadedFileMetadatas),
            updatedAt: serverTimestamp()
        });

        if (!userProfile.uploadedFiles) userProfile.uploadedFiles = [];
        // Convert server timestamp to Date for immediate display consistency
        const clientReadyFiles = uploadedFileMetadatas.map(f => ({...f, uploadedAt: new Date()}));
        userProfile.uploadedFiles.push(...clientReadyFiles); // Update local profile

        renderProfileFilesList(); // Refresh UI
        showMessage("Upload Successful", `${filesToUpload.length} file(s) uploaded successfully.`, "success");
        profileFileUploadElement.value = ''; // Clear file input

    } catch (error) {
        console.error("[ProfileUpload] Error uploading profile documents:", error);
        logErrorToFirestore("uploadProfileDocuments", error.message, error);
        showMessage("Upload Failed", "Could not upload files. " + error.message, "error");
    } finally {
        hideLoading();
    }
}
// Requests confirmation before deleting a profile document
function requestDeleteProfileDocument(fileName, filePath) {
    showConfirmationModal(
        "Confirm Delete Document",
        `Are you sure you want to delete the document "${fileName}"? This action cannot be undone.`,
        () => executeDeleteProfileDocument(fileName, filePath) // Pass the actual delete function as callback
    );
}
// Executes the deletion of a profile document from Storage and Firestore profile
async function executeDeleteProfileDocument(fileName, filePath) {
    if (!fbStorage || !fsDb || !currentUserId || !filePath) {
        showMessage("Delete Error", "Could not delete file. System error or missing information.", "error");
        logErrorToFirestore("executeDeleteProfileDocument", "System error/missing info", {fbStorage:!!fbStorage, fsDb:!!fsDb, uid:!!currentUserId, filePath:!!filePath});
        return;
    }
    showLoading(`Deleting ${fileName}...`);
    try {
        const fileRef = ref(fbStorage, filePath); // Reference to the file in Storage
        await deleteObject(fileRef); // Delete from Storage
        console.log("[ProfileDelete] File deleted from Storage:", filePath);

        const profileRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        // Find the exact file object to remove from the array in Firestore
        const fileToRemove = (userProfile.uploadedFiles || []).find(f => f.path === filePath);
        if (fileToRemove) {
            await updateDoc(profileRef, {
                uploadedFiles: arrayRemove(fileToRemove), // Firestore's arrayRemove needs the exact object
                updatedAt: serverTimestamp()
            });
            // Update local profile state
            userProfile.uploadedFiles = (userProfile.uploadedFiles || []).filter(f => f.path !== filePath);
            renderProfileFilesList(); // Refresh UI
            showMessage("File Deleted", `"${fileName}" has been deleted.`, "success");
        } else { // Fallback if local userProfile.uploadedFiles is out of sync
             console.warn("[ProfileDelete] File to remove not found in local userProfile.uploadedFiles. Attempting Firestore fetch and update.");
             const currentProfileSnap = await getDoc(profileRef);
             if (currentProfileSnap.exists()) {
                 const currentProfileData = currentProfileSnap.data();
                 const fileObjectInFirestore = (currentProfileData.uploadedFiles || []).find(f => f.path === filePath);
                 if (fileObjectInFirestore) {
                    await updateDoc(profileRef, { uploadedFiles: arrayRemove(fileObjectInFirestore), updatedAt: serverTimestamp() });
                    userProfile.uploadedFiles = (currentProfileData.uploadedFiles || []).filter(f => f.path !== filePath); // Update local state
                    renderProfileFilesList();
                    showMessage("File Deleted", `"${fileName}" has been deleted.`, "success");
                 } else {
                    console.error("[ProfileDelete] Fallback failed: File object not found in Firestore snapshot either for path:", filePath);
                    throw new Error("File metadata not found in profile for deletion.");
                 }
             } else {
                console.error("[ProfileDelete] Fallback failed: Profile document not found for user:", currentUserId);
                throw new Error("Profile document not found during delete operation's fallback.");
             }
        }
    } catch (error) {
        console.error("[ProfileDelete] Error deleting profile document:", error);
        logErrorToFirestore("executeDeleteProfileDocument", error.message, {fileName, filePath, error});
        showMessage("Delete Failed", `Could not delete "${fileName}". ${error.message}`, "error");
    } finally {
        hideLoading();
    }
};

/* ========== Invoice Functions ========== */
// Renders the invoice section
function renderInvoiceSection() {
    if (!userProfile || !currentUserId) {
        console.warn("[Invoice] Cannot render invoice section: User profile not loaded.");
        // Potentially clear invoice fields or show a message
        return;
    }
    console.log("[Invoice] Rendering invoice section.");
    populateInvoiceHeader(); // Populate header fields (invoice #, date, provider info)
    loadUserInvoiceDraft(); // Load existing draft or start a new one
}

// Populates the header fields of the invoice form
function populateInvoiceHeader() {
    if (!userProfile) return;

    if(invoiceDateInputElement) invoiceDateInputElement.value = formatDateForInput(new Date()); // Default to today
    if(invoiceWeekLabelElement && invoiceDateInputElement) invoiceWeekLabelElement.textContent = getWeekNumber(new Date(invoiceDateInputElement.value));
    if(invoiceNumberInputElement) invoiceNumberInputElement.value = userProfile.nextInvoiceNumber || '1001'; // Use next available or default

    // Provider details from user's profile
    if(providerNameInputElement) providerNameInputElement.value = userProfile.name || '';
    if(providerAbnInputElement) providerAbnInputElement.value = userProfile.abn || '';
    if(gstFlagInputElement) gstFlagInputElement.checked = userProfile.gstRegistered || false; // Reflect GST status

    // Participant and Plan Manager details (can be from global settings or current invoice draft)
    const participantNameInput = $("#invParticipantName");
    const participantNdisInput = $("#invParticipantNdisNo");
    const planManagerNameInput = $("#invPlanManagerName");
    const planManagerEmailInput = $("#invPlanManagerEmail");

    if(participantNameInput) participantNameInput.value = currentInvoiceData.participantName || globalSettings.defaultParticipantName || '';
    if(participantNdisInput) participantNdisInput.value = currentInvoiceData.participantNdisNo || globalSettings.defaultParticipantNdisNo || '';
    if(planManagerNameInput) planManagerNameInput.value = currentInvoiceData.planManagerName || globalSettings.defaultPlanManagerName || '';
    if(planManagerEmailInput) planManagerEmailInput.value = currentInvoiceData.planManagerEmail || globalSettings.defaultPlanManagerEmail || '';

    // Toggle GST row visibility based on provider's GST registration
    if(gstRowElement) gstRowElement.style.display = gstFlagInputElement.checked ? '' : 'none';
    gstFlagInputElement?.addEventListener('change', () => { // Recalculate totals if GST status changes
        if(gstRowElement) gstRowElement.style.display = gstFlagInputElement.checked ? '' : 'none';
        updateInvoiceTotals();
    });
}

// Renders the table of invoice items
function renderInvoiceTable() {
    if (!invoiceTableBodyElement) return;
    invoiceTableBodyElement.innerHTML = ''; // Clear existing items
    currentInvoiceData.items.forEach((item, index) => {
        addInvoiceRowToTable(item, index); // Add each item as a row
    });
    if (currentInvoiceData.items.length === 0) {
        // Optionally add a default empty row or a "No items yet" message
        // addInvRowUserAction(); // Or display a placeholder
    }
    updateInvoiceTotals(); // Recalculate and display totals
}

// Adds a new row to the invoice items table (for an existing or new item)
function addInvoiceRowToTable(item = {}, index = -1) {
    if (!invoiceTableBodyElement) return;
    const newRow = invoiceTableBodyElement.insertRow(index); // index -1 appends
    newRow.classList.add('invoice-item-row');
    newRow.dataset.itemId = item.id || generateUniqueId('item_'); // Assign/get unique ID for the item

    // Determine which services to show in the dropdown: admin sees all, user sees their authorized ones
    const availableServices = userProfile.isAdmin ? adminManagedServices : (userProfile.authorizedServices || []).map(authId => adminManagedServices.find(s => s.id === authId)).filter(s => s);

    newRow.innerHTML = `
        <td>${invoiceTableBodyElement.rows.length}</td> <td><input type="date" class="form-input inv-item-date" value="${item.date ? formatDateForInput(new Date(item.date)) : formatDateForInput(new Date())}"></td>
        <td>
            <select class="form-input inv-item-service-code">
                <option value="">Select Service</option>
                ${availableServices.map(service => 
                    `<option value="${service.id}" ${item.serviceId === service.id ? 'selected' : ''} data-code="${service.serviceCode || ''}" data-travel-code="${service.travelCode || ''}">${service.description} (${service.serviceCode || 'No Code'})</option>`
                ).join('')}
            </select>
        </td>
        <td><input type="text" class="form-input inv-item-desc" placeholder="Service Description" value="${item.description || ''}"></td>
        <td><input type="time" class="form-input inv-item-start" value="${item.startTime || '09:00'}"></td>
        <td><input type="time" class="form-input inv-item-end" value="${item.endTime || '10:00'}"></td>
        <td><input type="number" class="form-input inv-item-hours" value="${item.hours || '1.00'}" step="0.01" readonly></td>
        <td><input type="number" class="form-input inv-item-rate" value="${parseFloat(item.rate || 0).toFixed(2)}" step="0.01"></td>
        <td><input type="number" class="form-input inv-item-total" value="${parseFloat(item.total || 0).toFixed(2)}" step="0.01" readonly></td>
        <td><button class="btn btn-danger btn-sm delete-row-btn"><i class="fas fa-trash"></i></button></td>
    `;
    // Add event listeners to new row inputs for dynamic updates
    newRow.querySelectorAll('.inv-item-date, .inv-item-desc, .inv-item-service-code, .inv-item-start, .inv-item-end, .inv-item-rate').forEach(input => {
        input.addEventListener('change', () => updateInvoiceItemFromRow(newRow, Array.from(invoiceTableBodyElement.children).indexOf(newRow) ));
        if (input.type === 'text' || input.type === 'number') { // For live input on text/number fields
             input.addEventListener('input', () => updateInvoiceItemFromRow(newRow, Array.from(invoiceTableBodyElement.children).indexOf(newRow) ));
        }
    });
    newRow.querySelector('.delete-row-btn').addEventListener('click', function() {
        requestDeleteInvoiceRow(this); // Use new request function
    });

    updateInvoiceItemFromRow(newRow, Array.from(invoiceTableBodyElement.children).indexOf(newRow)); // Initial calculation for the row
}

// Handles the user action of adding a new invoice row
function addInvRowUserAction() {
    const newItem = { id: generateUniqueId('item_'), date: formatDateForInput(new Date()) }; // Create a new item object
    currentInvoiceData.items.push(newItem); // Add to local data store
    addInvoiceRowToTable(newItem, currentInvoiceData.items.length - 1); // Add to UI table
    // updateInvoiceTotals(); // Called by addInvoiceRowToTable via updateInvoiceItemFromRow
}


// Updates an invoice item in currentInvoiceData based on changes in its table row
function updateInvoiceItemFromRow(row, index) {
    if (!row || index < 0 || index >= currentInvoiceData.items.length) {
        console.warn("updateInvoiceItemFromRow: Row or index invalid.", {rowIndex: index, totalItems: currentInvoiceData.items.length});
        return;
    }

    const item = currentInvoiceData.items[index];
    if (!item) { console.warn("Item not found in currentInvoiceData at index", index); return; }

    // Get values from row inputs
    const dateInput = row.querySelector('.inv-item-date');
    const descInput = row.querySelector('.inv-item-desc');
    const serviceCodeSelect = row.querySelector('.inv-item-service-code');
    const startInput = row.querySelector('.inv-item-start');
    const endInput = row.querySelector('.inv-item-end');
    const hoursInput = row.querySelector('.inv-item-hours');
    const rateInput = row.querySelector('.inv-item-rate');
    const totalInput = row.querySelector('.inv-item-total');

    // Update item object
    item.date = dateInput.value;
    item.description = descInput.value;
    item.startTime = startInput.value;
    item.endTime = endInput.value;

    const selectedServiceOption = serviceCodeSelect.options[serviceCodeSelect.selectedIndex];
    item.serviceId = selectedServiceOption ? selectedServiceOption.value : '';
    item.serviceCode = selectedServiceOption ? selectedServiceOption.dataset.code : ''; // Store NDIS item code

    // Auto-populate rate and description if a service is selected
    if (item.serviceId) {
        const service = adminManagedServices.find(s => s.id === item.serviceId);
        if (service) {
            if (!item.description && service.description) { // Auto-populate description if empty
                descInput.value = service.description;
                item.description = service.description;
            }
            const rateType = determineRateType(item.date, item.startTime); // e.g., weekday, saturday
            let determinedRate = 0;
            // Determine rate based on service category type and rate type
            if (service.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM || service.categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
                determinedRate = service.rates?.flat || 0; // Flat rate for travel or other
            } else { // For core or capacity building services with time-based rates
                determinedRate = service.rates?.[rateType] || service.rates?.weekday || 0; // Use specific rate type or fallback to weekday
            }
            rateInput.value = parseFloat(determinedRate).toFixed(2);
        }
    }
    item.rate = parseFloat(rateInput.value) || 0;

    // Calculate hours and total
    const hours = calculateHours(item.startTime, item.endTime);
    hoursInput.value = hours.toFixed(2);
    item.hours = hours;

    const total = item.hours * item.rate;
    totalInput.value = total.toFixed(2);
    item.total = total;

    updateInvoiceTotals(); // Recalculate overall invoice totals
}

// Requests confirmation before deleting an invoice row
function requestDeleteInvoiceRow(buttonElement) {
    const row = buttonElement.closest('tr');
    if (!row || !invoiceTableBodyElement) return;
    const rowIndex = Array.from(invoiceTableBodyElement.children).indexOf(row);
    const itemNumber = rowIndex + 1;

    showConfirmationModal(
        "Confirm Delete Item",
        `Are you sure you want to delete invoice item #${itemNumber}?`,
        () => executeDeleteInvoiceRow(row, rowIndex)
    );
}

// Executes the deletion of an invoice row
function executeDeleteInvoiceRow(row, rowIndex) {
    if (rowIndex > -1 && rowIndex < currentInvoiceData.items.length) {
        currentInvoiceData.items.splice(rowIndex, 1); // Remove from data
        row.remove(); // Remove from UI
        // Re-number remaining rows visually
        const rows = invoiceTableBodyElement.querySelectorAll('tr');
        rows.forEach((r, idx) => {
            if (r.cells[0]) r.cells[0].textContent = idx + 1;
        });
        updateInvoiceTotals(); // Recalculate totals
        console.log("[Invoice] Row deleted at index:", rowIndex);
    } else {
        console.warn("[Invoice] Could not delete row, index out of bounds or row not found in table body.");
        logErrorToFirestore("executeDeleteInvoiceRow", "Index out of bounds or row not found", {rowIndex, itemsLength: currentInvoiceData.items.length});
    }
};

// Updates the subtotal, GST, and grand total of the invoice
function updateInvoiceTotals() {
    let subtotal = 0;
    currentInvoiceData.items.forEach(item => {
        subtotal += item.total || 0;
    });
    currentInvoiceData.subtotal = subtotal;

    let gstAmount = 0;
    if (gstFlagInputElement && gstFlagInputElement.checked) { // If provider is GST registered
        gstAmount = subtotal * 0.10; // Calculate 10% GST
    }
    currentInvoiceData.gst = gstAmount;

    const grandTotal = subtotal + gstAmount;
    currentInvoiceData.grandTotal = grandTotal;

    // Update UI display for totals
    if(subtotalElement) subtotalElement.textContent = formatCurrency(subtotal);
    if(gstAmountElement) gstAmountElement.textContent = formatCurrency(gstAmount);
    if(grandTotalElement) grandTotalElement.textContent = formatCurrency(grandTotal);

    console.log("[Invoice] Totals updated:", JSON.stringify(currentInvoiceData));
}

// Saves the current invoice as a draft to Firestore
async function saveInvoiceDraft() {
    if (!fsDb || !currentUserId || !userProfile) {
        showMessage("Error", "Cannot save draft. User not logged in or system error.", "error");
        logErrorToFirestore("saveInvoiceDraft", "DB/User/Profile missing for draft save");
        return;
    }
    // Ensure currentInvoiceData is up-to-date with form fields
    currentInvoiceData.invoiceNumber = invoiceNumberInputElement.value;
    currentInvoiceData.invoiceDate = invoiceDateInputElement.value;
    currentInvoiceData.providerName = providerNameInputElement.value;
    currentInvoiceData.providerAbn = providerAbnInputElement.value;
    currentInvoiceData.gstRegistered = gstFlagInputElement.checked;

    // Capture participant/plan manager details from the form into currentInvoiceData
    const participantNameInput = $("#invParticipantName");
    const participantNdisInput = $("#invParticipantNdisNo");
    const planManagerNameInput = $("#invPlanManagerName");
    const planManagerEmailInput = $("#invPlanManagerEmail");

    currentInvoiceData.participantName = participantNameInput?.value || globalSettings.defaultParticipantName;
    currentInvoiceData.participantNdisNo = participantNdisInput?.value || globalSettings.defaultParticipantNdisNo;
    currentInvoiceData.planManagerName = planManagerNameInput?.value || globalSettings.defaultPlanManagerName;
    currentInvoiceData.planManagerEmail = planManagerEmailInput?.value || globalSettings.defaultPlanManagerEmail;

    showLoading("Saving draft...");
    try {
        const draftRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, "draft");
        await setDoc(draftRef, { ...currentInvoiceData, lastSaved: serverTimestamp() }); // Save with timestamp
        showMessage("Draft Saved", "Your invoice draft has been saved.", "success");
        console.log("[Invoice] Draft saved to Firestore.");
    } catch (error) {
        console.error("[InvoiceSave] Error saving invoice draft:", error);
        logErrorToFirestore("saveInvoiceDraft", error.message, error);
        showMessage("Save Failed", "Could not save draft. " + error.message, "error");
    } finally {
        hideLoading();
    }
}

// Loads the user's invoice draft from Firestore, or initializes a new one
async function loadUserInvoiceDraft() {
    if (!fsDb || !currentUserId) { // Fallback if no DB or user
        currentInvoiceData = { items: [], invoiceNumber: userProfile.nextInvoiceNumber || "1001", invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0 };
        populateInvoiceHeader();
        renderInvoiceTable();
        return;
    }
    showLoading("Loading draft...");
    try {
        const draftRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, "draft");
        const snap = await getDoc(draftRef);
        if (snap.exists()) { // Draft found
            currentInvoiceData = snap.data();
            // Ensure dates are correctly formatted for input fields
            currentInvoiceData.invoiceDate = currentInvoiceData.invoiceDate ? formatDateForInput(new Date(currentInvoiceData.invoiceDate)) : formatDateForInput(new Date());
            currentInvoiceData.items = (currentInvoiceData.items || []).map(item => ({
                ...item,
                date: item.date ? formatDateForInput(new Date(item.date)) : formatDateForInput(new Date())
            }));
            console.log("[InvoiceLoad] Draft loaded from Firestore.");
        } else { // No draft found, start new
            console.log("[InvoiceLoad] No existing draft found. Starting new.");
            currentInvoiceData = { items: [], invoiceNumber: userProfile.nextInvoiceNumber || "1001", invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0 };
        }
        populateInvoiceHeader(); // Populate header with loaded/default data
        renderInvoiceTable();    // Render items from loaded/default data
    } catch (error) {
        console.error("[InvoiceLoad] Error loading invoice draft:", error);
        logErrorToFirestore("loadUserInvoiceDraft", error.message, error);
        showMessage("Load Failed", "Could not load draft. " + error.message, "error");
        // Fallback to default empty state on error
        currentInvoiceData = { items: [], invoiceNumber: userProfile.nextInvoiceNumber || "1001", invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0 };
        populateInvoiceHeader();
        renderInvoiceTable();
    } finally {
        hideLoading();
    }
}

// Saves the initial invoice number set by the user
async function saveInitialInvoiceNumber() {
    if (!initialInvoiceNumberInputElement) return;
    const numStr = initialInvoiceNumberInputElement.value;
    const n = parseInt(numStr, 10);
    if (isNaN(n) || n <= 0) {
        showMessage("Invalid Number", "Please enter a positive whole number for the initial invoice.", "warning");
        return;
    }
    if (userProfile) {
        userProfile.nextInvoiceNumber = n; // Update local profile
        const success = await saveProfileDetails({ nextInvoiceNumber: n }); // Save to Firestore profile
        if (success) {
            closeModal('setInitialInvoiceModal');
            if(invoiceNumberInputElement) invoiceNumberInputElement.value = n; // Update current invoice form
            showMessage("Invoice Number Set", `Your next invoice number will start from ${n}.`, "success");
        } else {
            showMessage("Error", "Could not save initial invoice number.", "error");
        }
    } else {
        showMessage("Error", "User profile not loaded. Cannot save setting.", "error");
        logErrorToFirestore("saveInitialInvoiceNumber", "User profile not loaded");
    }
}

// Generates a PDF of the current invoice
function generateInvoicePdf() {
    if (!currentInvoiceData || !invoicePdfContentElement) {
        showMessage("Error", "No invoice data to generate PDF.", "error");
        return;
    }
    if (typeof html2pdf === 'undefined') { // Check if html2pdf library is loaded
        showMessage("Error", "PDF generation library not loaded. Please refresh.", "error");
        logErrorToFirestore("generateInvoicePdf", "html2pdf library not found");
        return;
    }

    showLoading("Generating PDF...");

    // Prepare invoicePdfContentElement for PDF generation (e.g., show print-only columns)
    invoicePdfContentElement.classList.add('preparing-for-pdf'); // Add a class to trigger CSS for PDF layout
    // Ensure print-specific spans are populated with values from inputs
    currentInvoiceData.items.forEach((item, index) => {
        const row = invoiceTableBodyElement.rows[index];
        if (row) {
            row.querySelector('.date-print-value').textContent = formatDateForDisplay(new Date(item.date));
            row.querySelector('.code-print-value').textContent = item.serviceCode || 'N/A';
            row.querySelector('.description-print-value').textContent = item.description || '';
            row.querySelector('.start-time-print-value').textContent = formatTime12Hour(item.startTime);
            row.querySelector('.end-time-print-value').textContent = formatTime12Hour(item.endTime);
            // Assuming rate type determination logic exists and populates item.rateType
            // row.querySelector('.rate-type-print-value').textContent = item.rateType || determineRateType(item.date, item.startTime);
            // row.querySelector('.rate-unit-print-value').textContent = formatCurrency(item.rate);
            row.querySelector('.hours-km-print-value').textContent = item.hours.toFixed(2);
            row.querySelector('.total-print-value').textContent = formatCurrency(item.total);
        }
    });


    const opt = { // Options for html2pdf
        margin:       0.5, // inches
        filename:     `Invoice-${currentInvoiceData.invoiceNumber || 'draft'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, scrollY: -window.scrollY }, // Try to capture from top
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(invoicePdfContentElement).set(opt).save()
        .then(() => {
            hideLoading();
            showMessage("PDF Generated", "Invoice PDF has been downloaded.", "success");
            // If not admin, increment invoice number and reset form for next invoice
            if (!userProfile.isAdmin) {
                const nextInvNum = (parseInt(currentInvoiceData.invoiceNumber, 10) || 0) + 1;
                if (userProfile) {
                    userProfile.nextInvoiceNumber = nextInvNum; // Update local
                    saveProfileDetails({ nextInvoiceNumber: nextInvNum }); // Save to Firestore
                    if(invoiceNumberInputElement) invoiceNumberInputElement.value = nextInvNum; // Update current form
                }
                // Reset current invoice form
                currentInvoiceData = { items: [], invoiceNumber: String(nextInvNum), invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0 };
                populateInvoiceHeader();
                renderInvoiceTable();
            }
        })
        .catch(err => {
            hideLoading();
            console.error("[InvoicePDF] PDF Generation Error:", err);
            logErrorToFirestore("generateInvoicePdf", err.message, err);
            showMessage("PDF Error", "Could not generate PDF. " + err.message, "error");
        })
        .finally(() => {
            invoicePdfContentElement.classList.remove('preparing-for-pdf'); // Clean up class
        });
}


/* ========== Agreement Functions ========== */
// Renders the service agreement section
function renderAgreementSection() {
    if (!userProfile || !currentUserId) {
        console.warn("[Agreement] Cannot render agreement: User profile not loaded.");
        return;
    }
    console.log("[Agreement] Rendering agreement section.");

    if (userProfile.isAdmin) { // Admin view: selector for workers
        if(adminAgreementWorkerSelectorElement) adminAgreementWorkerSelectorElement.style.display = 'block';
        if(adminSelectWorkerForAgreementElement) { // Populate dropdown with approved, non-admin workers
            adminSelectWorkerForAgreementElement.innerHTML = '<option value="">-- Select Worker --</option>';
            Object.values(allUsersCache).filter(u => !u.isAdmin && u.approved).forEach(worker => {
                const option = document.createElement('option');
                option.value = worker.email; // Use email as value
                option.textContent = `${worker.name || worker.email} (${worker.email})`;
                adminSelectWorkerForAgreementElement.appendChild(option);
            });
        }
        // Admin must select a worker to view agreement
        if(agreementContentContainerElement) agreementContentContainerElement.innerHTML = "<p>Select a worker to view or manage their service agreement.</p>";
        updateAgreementChip(null); // No agreement loaded initially
    } else { // Regular user view: their own agreement
        if(adminAgreementWorkerSelectorElement) adminAgreementWorkerSelectorElement.style.display = 'none';
        currentAgreementWorkerEmail = currentUserEmail; // It's their own agreement
        loadAndRenderServiceAgreement(currentAgreementWorkerEmail);
    }
}

// Loads and renders the service agreement for a specific worker
async function loadAndRenderServiceAgreement(workerEmailToLoad = null) {
    const targetWorkerEmail = workerEmailToLoad || currentUserEmail; // Default to current user if none specified
    if (!fsDb || !targetWorkerEmail) {
        if(agreementContentContainerElement) agreementContentContainerElement.innerHTML = "<p>Cannot load agreement: Worker email or database not specified.</p>";
        updateAgreementChip(null);
        logErrorToFirestore("loadAndRenderServiceAgreement", "Worker email or DB not specified", {targetWorkerEmail, fsDb:!!fsDb});
        return;
    }
    showLoading("Loading agreement...");
    try {
        let targetWorkerProfile = null;
        // Get the profile of the worker whose agreement is being loaded
        if (targetWorkerEmail === currentUserEmail && userProfile.email === targetWorkerEmail) { // Current user's own profile
            targetWorkerProfile = userProfile;
        } else if (userProfile.isAdmin) { // Admin looking up another worker
            targetWorkerProfile = Object.values(allUsersCache).find(u => u.email === targetWorkerEmail);
        }

        if (!targetWorkerProfile || !targetWorkerProfile.uid) {
            throw new Error(`Worker profile not found for ${targetWorkerEmail}`);
        }
        const targetWorkerUid = targetWorkerProfile.uid;
        currentAgreementWorkerEmail = targetWorkerEmail; // Store whose agreement is active

        const agreementRef = doc(fsDb, `artifacts/${appId}/users/${targetWorkerUid}/agreement`, "details");
        const agreementSnap = await getDoc(agreementRef);
        let agreementData;

        if (agreementSnap.exists()) { // Agreement exists
            agreementData = agreementSnap.data();
            console.log("[AgreementLoad] Loaded existing agreement for:", targetWorkerEmail);
        } else { // No agreement exists, create a new draft
            console.log("[AgreementLoad] No existing agreement for:", targetWorkerEmail, ". Creating new from template.");
            const newAgreementContentSnapshot = renderAgreementClauses(targetWorkerProfile, globalSettings, {}, true); // Get HTML string
            agreementData = { // Default structure for a new agreement
                workerUid: targetWorkerUid,
                workerEmail: targetWorkerProfile.email,
                participantSignature: null, participantSignatureDate: null,
                workerSignature: null, workerSignatureDate: null,
                status: "draft", // Initial status
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                contentSnapshot: newAgreementContentSnapshot, // Store the generated HTML
                agreementTemplateUsed: JSON.parse(JSON.stringify(agreementCustomData)) // Store template used
            };
            await setDoc(agreementRef, agreementData); // Save the new draft to Firestore
            console.log("[AgreementLoad] New draft agreement saved for:", targetWorkerEmail);
        }

        window.currentLoadedAgreement = agreementData; // Store globally for signature saving
        window.currentLoadedAgreementWorkerUid = targetWorkerUid; // Store UID for saving

        // Render the agreement content (from snapshot or freshly generated if needed)
        const agreementHtmlToRender = agreementData.contentSnapshot || renderAgreementClauses(targetWorkerProfile, globalSettings, agreementData, true);
        if (agreementContentContainerElement) agreementContentContainerElement.innerHTML = agreementHtmlToRender;

        updateAgreementChip(agreementData); // Update status chip (Draft, Signed, etc.)
        updateSignatureDisplays(agreementData); // Update signature images and dates
        updateAgreementActionButtons(targetWorkerProfile); // Update action buttons (Sign, Download PDF)

    } catch (error) {
        console.error("[AgreementLoad] Error loading/rendering service agreement:", error);
        logErrorToFirestore("loadAndRenderServiceAgreement", error.message, { workerEmail: targetWorkerEmail, error });
        if(agreementContentContainerElement) agreementContentContainerElement.innerHTML = `<p class="text-danger" style="color:var(--danger);">Could not load service agreement: ${error.message}</p>`;
        updateAgreementChip(null);
    } finally {
        hideLoading();
    }
}

// Renders the clauses of the service agreement, replacing placeholders
function renderAgreementClauses(workerProfile, settings, agreementState, returnAsString = false) {
    if (!workerProfile || !settings || !agreementCustomData || !agreementCustomData.clauses) {
        const errorMsg = "<p>Error: Missing data for agreement generation. Please check admin settings for agreement template.</p>";
        logErrorToFirestore("renderAgreementClauses", "Missing data for agreement generation", {hasWorker:!!workerProfile, hasSettings:!!settings, hasTemplate:!!agreementCustomData});
        if (returnAsString) return errorMsg;
        if(agreementContentContainerElement) agreementContentContainerElement.innerHTML = errorMsg;
        return;
    }

    let html = `<h2>${agreementCustomData.overallTitle || defaultAgreementCustomData.overallTitle}</h2>`;
    if (agreementDynamicTitleElement) agreementDynamicTitleElement.innerHTML = `<i class="fas fa-handshake"></i> ${agreementCustomData.overallTitle || defaultAgreementCustomData.overallTitle}`;

    // Determine list of services for the {{serviceList}} placeholder
    let workerAuthorizedServicesForAgreement = [];
    if (workerProfile.isAdmin && currentAgreementWorkerEmail === currentUserEmail) { // Admin viewing their own "template" agreement
        workerAuthorizedServicesForAgreement = adminManagedServices.filter(s => s.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM);
    } else if (workerProfile.authorizedServices && workerProfile.authorizedServices.length > 0) { // Regular worker's authorized services
        workerAuthorizedServicesForAgreement = adminManagedServices.filter(s => workerProfile.authorizedServices.includes(s.id) && s.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM);
    }

    let serviceListHtml = "<ul>";
    if (workerAuthorizedServicesForAgreement.length > 0) {
        workerAuthorizedServicesForAgreement.forEach(service => {
            serviceListHtml += `<li><strong>${service.serviceCode || 'N/A'}:</strong> ${service.description}</li>`;
        });
    } else {
        serviceListHtml += "<li>No specific services currently authorized/listed. General support services as agreed.</li>";
    }
    serviceListHtml += "</ul>";

    // Dates for placeholders
    const agreementEffectiveDate = agreementState?.createdAt?.toDate ? agreementState.createdAt.toDate() : new Date();
    const agreementEndDate = settings.defaultPlanEndDate ? new Date(settings.defaultPlanEndDate) : new Date(new Date().setFullYear(new Date().getFullYear() + 1));

    // Replace placeholders in each clause
    agreementCustomData.clauses.forEach(clause => {
        let clauseBody = clause.body;
        clauseBody = clauseBody.replace(/\{\{participantName\}\}/g, settings.defaultParticipantName || 'The Participant');
        clauseBody = clauseBody.replace(/\{\{participantNdisNo\}\}/g, settings.defaultParticipantNdisNo || 'N/A');
        clauseBody = clauseBody.replace(/\{\{planEndDate\}\}/g, formatDateForDisplay(agreementEndDate));
        clauseBody = clauseBody.replace(/\{\{workerName\}\}/g, workerProfile.name || 'The Provider');
        clauseBody = clauseBody.replace(/\{\{workerAbn\}\}/g, workerProfile.abn || 'N/A');
        clauseBody = clauseBody.replace(/\{\{serviceList\}\}/g, serviceListHtml);
        clauseBody = clauseBody.replace(/\{\{planManagerName\}\}/g, settings.defaultPlanManagerName || 'The Plan Manager');
        clauseBody = clauseBody.replace(/\{\{planManagerEmail\}\}/g, settings.defaultPlanManagerEmail || 'N/A');
        clauseBody = clauseBody.replace(/\{\{agreementStartDate\}\}/g, formatDateForDisplay(agreementEffectiveDate));
        clauseBody = clauseBody.replace(/\{\{agreementEndDate\}\}/g, formatDateForDisplay(agreementEndDate));

        // Add clause to HTML (simple markdown for bold and newlines)
        html += `<h3>${clause.heading}</h3>`;
        html += `<div class="clause-body">${clauseBody.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</div>`;
    });

    if (returnAsString) return html; // Return as string if requested (for saving snapshot)
    if(agreementContentContainerElement) agreementContentContainerElement.innerHTML = html; // Render to page
    console.log("[Agreement] Clauses rendered for worker:", workerProfile.email);
}

// Updates the display of signatures (images and dates)
function updateSignatureDisplays(agreementData) {
    if (!agreementData) return;
    const placeholderSig = 'https://placehold.co/250x85/e8e8e8/666666?text=Signature+Area&txtsize=16';
    if (participantSignatureImageElement) {
        participantSignatureImageElement.src = agreementData.participantSignature || placeholderSig;
        participantSignatureImageElement.style.border = agreementData.participantSignature ? '1px solid var(--ok)' : '1px dashed var(--bd)';
    }
    if (participantSignatureDateElement) {
        participantSignatureDateElement.textContent = agreementData.participantSignatureDate ? `Signed: ${formatDateForDisplay(agreementData.participantSignatureDate.toDate ? agreementData.participantSignatureDate.toDate() : new Date(agreementData.participantSignatureDate))}` : 'Not Signed';
    }
    if (workerSignatureImageElement) {
        workerSignatureImageElement.src = agreementData.workerSignature || placeholderSig;
        workerSignatureImageElement.style.border = agreementData.workerSignature ? '1px solid var(--ok)' : '1px dashed var(--bd)';
    }
    if (workerSignatureDateElement) {
        workerSignatureDateElement.textContent = agreementData.workerSignatureDate ? `Signed: ${formatDateForDisplay(agreementData.workerSignatureDate.toDate ? agreementData.workerSignatureDate.toDate() : new Date(agreementData.workerSignatureDate))}` : 'Not Signed';
    }
}

// Updates the status chip for the agreement (Draft, Signed, Active)
function updateAgreementChip(agreementData) {
    if (!agreementChipElement) return;
    if (!agreementData || !agreementData.status) { // Handle null or missing status
        agreementChipElement.textContent = "N/A";
        agreementChipElement.className = 'chip hide';
        return;
    }

    let statusText = "Draft";
    let chipClass = "chip yellow"; // Default for draft

    switch(agreementData.status) {
        case "active":
            statusText = "Active - Fully Signed";
            chipClass = "chip green";
            break;
        case "signed_by_worker":
            statusText = "Signed by Worker - Awaiting Participant";
            chipClass = "chip blue";
            break;
        case "signed_by_participant":
            statusText = "Signed by Participant - Awaiting Worker";
            chipClass = "chip blue";
            break;
        case "draft":
        default: // Fallback to draft if status is unknown or explicitly draft
            statusText = "Draft - Awaiting Signatures";
            chipClass = "chip yellow";
            break;
    }

    agreementChipElement.textContent = statusText;
    agreementChipElement.className = chipClass; // Apply new class
    agreementChipElement.classList.remove('hide'); // Ensure visible
}

// Updates the visibility and text of agreement action buttons
function updateAgreementActionButtons(targetWorkerProfile) {
    if (!window.currentLoadedAgreement || !signAgreementButtonElement || !participantSignButtonElement || !downloadAgreementPdfButtonElement || !targetWorkerProfile) return;

    const agreementData = window.currentLoadedAgreement;
    const isCurrentUserTheWorkerOfAgreement = currentUserId === targetWorkerProfile.uid; // Is the logged-in user the owner of this agreement?
    const isAdminViewing = userProfile.isAdmin;

    // Worker's "Sign agreement" button
    signAgreementButtonElement.classList.add('hide'); // Hide by default
    if (isCurrentUserTheWorkerOfAgreement && !agreementData.workerSignature) { // If current user is the worker and hasn't signed
        signAgreementButtonElement.classList.remove('hide');
        signAgreementButtonElement.textContent = "Sign as Support Worker";
    }

    // Admin's "Sign for Participant" button
    participantSignButtonElement.classList.add('hide'); // Hide by default
    // Admin can sign for participant if:
    // 1. Admin is viewing another worker's agreement AND participant hasn't signed
    // 2. Admin is viewing their OWN agreement (as a worker) AND participant (themselves in this odd case) hasn't signed
    if (isAdminViewing && !agreementData.participantSignature) {
        if (!isCurrentUserTheWorkerOfAgreement || (isCurrentUserTheWorkerOfAgreement && globalSettings.portalType === 'individual_participant')) { // Case 1 or specific individual setup
            participantSignButtonElement.classList.remove('hide');
            participantSignButtonElement.textContent = "Sign for Participant (Admin)";
        }
    }

    // PDF Download button: show if agreement exists (draft or signed)
    if (agreementData && agreementData.contentSnapshot) {
         downloadAgreementPdfButtonElement.classList.remove('hide');
    } else {
         downloadAgreementPdfButtonElement.classList.add('hide');
    }
}

// Opens the signature modal for either worker or participant
function openSignatureModal(whoIsSigning) {
    signingAs = whoIsSigning; // 'worker' or 'participant'
    if (signatureModalElement) {
        const titleElement = signatureModalElement.querySelector('h3');
        if (titleElement) {
            let titleText = "Draw Signature";
            if (signingAs === 'worker') {
                titleText = (currentAgreementWorkerEmail === currentUserEmail) ? 'Draw Your Signature (Support Worker)' : `Draw Signature for Support Worker (${currentAgreementWorkerEmail})`;
            } else if (signingAs === 'participant') {
                titleText = 'Draw Signature for Participant';
            }
            titleElement.innerHTML = `<i class="fas fa-pencil-alt"></i> ${titleText}`;
        }
        openModal('sigModal');
        initializeSignaturePad(); // Initialize or re-initialize the canvas
    }
}

// Initializes the signature pad canvas
function initializeSignaturePad() {
    if (!signatureCanvasElement) return;
    sigCanvas = signatureCanvasElement;
    sigCtx = sigCanvas.getContext('2d');

    // Adjust canvas for high DPI screens
    const devicePixelRatio = window.devicePixelRatio || 1;
    sigCanvas.width = sigCanvas.offsetWidth * devicePixelRatio;
    sigCanvas.height = sigCanvas.offsetHeight * devicePixelRatio;
    sigCtx.scale(devicePixelRatio, devicePixelRatio);

    // Set drawing style
    sigCtx.strokeStyle = "#000000";
    sigCtx.lineWidth = 2;
    sigCtx.lineCap = "round";
    sigCtx.lineJoin = "round";

    clearSignaturePad(); // Clear any previous drawing

    // Remove old listeners to prevent duplicates if re-initialized
    sigCanvas.removeEventListener('mousedown', sigStart);
    sigCanvas.removeEventListener('mousemove', sigDraw);
    sigCanvas.removeEventListener('mouseup', sigEnd);
    sigCanvas.removeEventListener('mouseout', sigEnd);
    sigCanvas.removeEventListener('touchstart', sigStart);
    sigCanvas.removeEventListener('touchmove', sigDraw);
    sigCanvas.removeEventListener('touchend', sigEnd);

    // Add new event listeners for drawing
    sigCanvas.addEventListener('mousedown', sigStart, false);
    sigCanvas.addEventListener('mousemove', sigDraw, false);
    sigCanvas.addEventListener('mouseup', sigEnd, false);
    sigCanvas.addEventListener('mouseout', sigEnd); // Stop drawing if mouse leaves canvas
    sigCanvas.addEventListener('touchstart', sigStart, { passive: false }); // Passive false to allow preventDefault
    sigCanvas.addEventListener('touchmove', sigDraw, { passive: false });
    sigCanvas.addEventListener('touchend', sigEnd);
    console.log("[Signature] Pad initialized.");
}

// Clears the signature pad
function clearSignaturePad() {
    if (!sigCtx || !sigCanvas) return;
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height); // Clear the canvas
    sigPaths = []; // Reset stored paths
    console.log("[Signature] Pad cleared.");
}

// Event handler for starting a signature stroke (mouse down or touch start)
function sigStart(e) {
    e.preventDefault(); // Prevent scrolling on touch devices
    sigPen = true; // Pen is down
    const pos = getSigPenPosition(e);
    sigCtx.beginPath();
    sigCtx.moveTo(pos.x, pos.y);
    sigPaths.push([{ x: pos.x, y: pos.y }]); // Start a new path
}

// Event handler for drawing a signature stroke (mouse move or touch move)
function sigDraw(e) {
    e.preventDefault();
    if (!sigPen) return; // Only draw if pen is down
    const pos = getSigPenPosition(e);
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.stroke();
    if (sigPaths.length > 0) { // Add point to current path
        sigPaths[sigPaths.length - 1].push({ x: pos.x, y: pos.y });
    }
}

// Event handler for ending a signature stroke (mouse up, mouse out, or touch end)
function sigEnd(e) {
    e.preventDefault();
    if (!sigPen) return;
    sigPen = false; // Pen is up
    // sigCtx.closePath(); // Not strictly necessary for line drawing
}

// Gets the pen position on the canvas, accounting for touch/mouse and canvas scaling
function getSigPenPosition(e) {
    const rect = sigCanvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) { // Touch event
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else { // Mouse event
        clientX = e.clientX;
        clientY = e.clientY;
    }
    // Adjust for canvas scaling (if CSS size differs from actual pixel size)
    const scaleX = sigCanvas.width / (rect.width * (window.devicePixelRatio || 1));
    const scaleY = sigCanvas.height / (rect.height * (window.devicePixelRatio || 1));

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}


// Saves the drawn signature to the current agreement in Firestore
async function saveSignature() {
    if (!sigCanvas || sigPaths.length === 0) { // Check if anything was drawn
        showMessage("Signature Error", "Please provide a signature before saving.", "warning");
        return;
    }
    if (!window.currentLoadedAgreement || !window.currentLoadedAgreementWorkerUid) {
        showMessage("Error", "No agreement loaded to save signature against. Please reload the agreement.", "error");
        logErrorToFirestore("saveSignature", "Attempted to save signature without a loaded agreement context.");
        return;
    }

    const signatureDataUrl = sigCanvas.toDataURL('image/png'); // Get signature as base64 PNG
    showLoading("Saving signature...");

    const agreementUpdate = {}; // Object to hold updates for Firestore
    const signatureDate = serverTimestamp(); // Use server timestamp for accuracy

    // Assign signature based on who is signing
    if (signingAs === 'worker') {
        agreementUpdate.workerSignature = signatureDataUrl;
        agreementUpdate.workerSignatureDate = signatureDate;
    } else if (signingAs === 'participant') {
        agreementUpdate.participantSignature = signatureDataUrl;
        agreementUpdate.participantSignatureDate = signatureDate;
    } else { // Should not happen
        hideLoading();
        showMessage("Error", "Unknown signer type. Cannot save signature.", "error");
        logErrorToFirestore("saveSignature", "Unknown signingAs value", { signingAs });
        return;
    }

    // Determine new agreement status based on current and new signatures
    let newStatus = window.currentLoadedAgreement.status || "draft";
    const hasWorkerSig = agreementUpdate.workerSignature || window.currentLoadedAgreement.workerSignature;
    const hasParticipantSig = agreementUpdate.participantSignature || window.currentLoadedAgreement.participantSignature;

    if (hasWorkerSig && hasParticipantSig) {
        newStatus = 'active'; // Both signed
    } else if (hasWorkerSig) {
        newStatus = 'signed_by_worker';
    } else if (hasParticipantSig) {
        newStatus = 'signed_by_participant';
    }
    agreementUpdate.status = newStatus;
    agreementUpdate.updatedAt = serverTimestamp(); // Update modification timestamp

    try {
        const agreementRef = doc(fsDb, `artifacts/${appId}/users/${window.currentLoadedAgreementWorkerUid}/agreement`, "details");
        // Check if document exists before trying to update, otherwise set (should exist due to loadAndRender logic)
        const agreementSnap = await getDoc(agreementRef);
        if (agreementSnap.exists()) {
            await updateDoc(agreementRef, agreementUpdate);
        } else { // Fallback: if agreement doc was somehow deleted, create it with the new signature
            console.warn("[SignatureSave] Agreement document did not exist. Creating new one with signature.");
            const workerProfileForNewAgreement = Object.values(allUsersCache).find(u => u.uid === window.currentLoadedAgreementWorkerUid) || (currentUserId === window.currentLoadedAgreementWorkerUid ? userProfile : null);
            if (!workerProfileForNewAgreement) throw new Error("Could not find worker profile to create new agreement.");

            const initialAgreementData = {
                workerUid: window.currentLoadedAgreementWorkerUid,
                workerEmail: workerProfileForNewAgreement.email,
                createdAt: serverTimestamp(), // Set creation too
                contentSnapshot: renderAgreementClauses(workerProfileForNewAgreement, globalSettings, {}, true),
                agreementTemplateUsed: JSON.parse(JSON.stringify(agreementCustomData)),
                ...agreementUpdate // Add the current signature and status
            };
            await setDoc(agreementRef, initialAgreementData);
            console.log("[SignatureSave] New agreement document created with signature.");
        }

        console.log(`[SignatureSave] ${signingAs} signature saved for UID: ${window.currentLoadedAgreementWorkerUid}. New status: ${newStatus}`);
        closeModal('sigModal');
        showMessage("Signature Saved", `${signingAs}'s signature has been successfully saved.`, "success");

        // Reload and re-render the agreement to show updated state
        await loadAndRenderServiceAgreement(currentAgreementWorkerEmail);

    } catch (error) {
        console.error(`[SignatureSave] Error saving ${signingAs} signature:`, error);
        logErrorToFirestore("saveSignature", error.message, { error, signingAs, workerUid: window.currentLoadedAgreementWorkerUid });
        showMessage("Save Failed", `Could not save ${signingAs} signature. ${error.message}`, "error");
    } finally {
        hideLoading();
    }
}

// Generates a PDF of the current service agreement
function generateAgreementPdf() {
    if (!agreementContentWrapperElement || !agreementHeaderForPdfElement || !window.currentLoadedAgreement) {
        showMessage("PDF Error", "Agreement content elements not found or no agreement loaded. Cannot generate PDF.", "error");
        logErrorToFirestore("generateAgreementPdf", "Content elements or agreement data missing");
        return;
    }
     if (typeof html2pdf === 'undefined') { // Check library
        showMessage("Error", "PDF generation library not loaded. Please refresh.", "error");
        logErrorToFirestore("generateAgreementPdf", "html2pdf library not found");
        return;
    }

    showLoading("Generating Agreement PDF...");

    // Clone the content to avoid modifying the live DOM in ways that affect display
    const contentClone = agreementContentWrapperElement.cloneNode(true);
    const headerClone = contentClone.querySelector("#agreementHeaderForPdf");
    if (headerClone) { // Populate and show the PDF-specific header
        headerClone.style.display = 'block';
        headerClone.innerHTML = `<h1>${window.currentLoadedAgreement.agreementTemplateUsed?.overallTitle || agreementCustomData.overallTitle || 'Service Agreement'}</h1>
                                 <p>Status: ${window.currentLoadedAgreement.status || 'Draft'}</p>`;
    }
    // Ensure signature images in the clone are from the saved data, not placeholders
    const sigPClone = contentClone.querySelector("#sigP");
    const sigWClone = contentClone.querySelector("#sigW");
    if (window.currentLoadedAgreement.participantSignature && sigPClone) sigPClone.src = window.currentLoadedAgreement.participantSignature;
    if (window.currentLoadedAgreement.workerSignature && sigWClone) sigWClone.src = window.currentLoadedAgreement.workerSignature;

    // Determine file name components
    const workerProfileForPdf = Object.values(allUsersCache).find(u => u.email === currentAgreementWorkerEmail) || (currentUserId === window.currentLoadedAgreementWorkerUid ? userProfile : null);
    const workerNameForFile = (workerProfileForPdf?.name || "Worker").replace(/\s+/g, '_');
    const participantNameForFile = (globalSettings.defaultParticipantName || "Participant").replace(/\s+/g, '_');

    const opt = { // html2pdf options
        margin:       [0.5, 0.5, 0.5, 0.5], // inches [top, left, bottom, right]
        filename:     `ServiceAgreement-${workerNameForFile}-${participantNameForFile}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, scrollY: 0 }, // Capture from top
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } // Attempt to avoid breaking elements across pages
    };

    html2pdf().from(contentClone).set(opt).save() // Use the cloned content
        .then(() => {
            hideLoading();
            showMessage("PDF Generated", "Service Agreement PDF has been downloaded.", "success");
        })
        .catch(err => {
            hideLoading();
            console.error("[AgreementPDF] PDF Generation Error:", err);
            logErrorToFirestore("generateAgreementPdf", err.message, err);
            showMessage("PDF Error", "Could not generate Agreement PDF. " + err.message, "error");
        });
}


/* ========== Admin Functions (Stubs - to be fully implemented as needed) ========== */
// These functions are placeholders. Full implementation would depend on specific requirements.
function renderAdminDashboard() { console.log("Admin Dashboard Rendered (Placeholder - implement full rendering)"); /* TODO: Populate admin dashboard with stats, quick links, etc. */ }
function switchAdminTab(targetId) {
    adminNavTabButtons.forEach(btn => btn.classList.remove('active'));
    adminContentPanels.forEach(panel => panel.classList.remove('active'));
    const activeBtn = $(`button.admin-tab-btn[data-target="${targetId}"]`);
    const activePanel = $(`#${targetId}.admin-content-panel`);
    if (activeBtn) activeBtn.classList.add('active');
    if (activePanel) activePanel.classList.add('active');
    else $(`#adminGlobalSettings`).classList.add('active'); // Fallback

    // Call specific render/load functions for the activated tab
    switch(targetId) {
        case 'adminGlobalSettings': renderAdminGlobalSettingsTab(); break;
        case 'adminServiceManagement': renderAdminServiceManagementTab(); break;
        case 'adminAgreementCustomization': renderAdminAgreementCustomizationTab(); break;
        case 'adminWorkerManagement': renderAdminWorkerManagementTab(); break;
    }
    console.log(`[Admin] Switched to tab: ${targetId}`);
}
function renderAdminGlobalSettingsTab() {
    console.log("Rendering Admin Global Settings Tab (Placeholder)");
    // Populate form fields with values from globalSettings object
    if(adminEditOrgNameInputElement) adminEditOrgNameInputElement.value = globalSettings.organizationName || '';
    // ... and so on for all global settings fields
    if(inviteLinkCodeElement) inviteLinkCodeElement.textContent = `${window.location.origin}${window.location.pathname}?register=true`; // Example invite link
}
async function saveAdminPortalSettings() {
    console.log("Saving Admin Portal Settings (Placeholder)");
    // Collect values from form fields
    globalSettings.organizationName = adminEditOrgNameInputElement?.value.trim() || globalSettings.organizationName;
    // ... and so on for all settings
    // globalSettings.setupComplete = true; // Mark setup as complete if this is the final step of a wizard
    await saveGlobalSettingsToFirestore();
}
function requestResetGlobalSettings() {
    showConfirmationModal(
        "Confirm Reset Settings",
        "Are you sure you want to reset all portal settings to their original defaults? This action cannot be undone and will affect all users.",
        executeResetGlobalSettings
    );
}
async function executeResetGlobalSettings() {
    showLoading("Resetting global settings...");
    globalSettings = getDefaultGlobalSettings(); // Reset to code defaults
    globalSettings.setupComplete = false; // Mark setup as incomplete again
    agreementCustomData = JSON.parse(JSON.stringify(defaultAgreementCustomData)); // Reset agreement template
    globalSettings.agreementTemplate = agreementCustomData;
    const success = await saveGlobalSettingsToFirestore(); // Save reset settings
    if (success) {
        renderAdminGlobalSettingsTab(); // Re-render tab with default values
        showMessage("Settings Reset", "Global portal settings have been reset to defaults.", "success");
    } else {
        showMessage("Reset Failed", "Could not reset global settings.", "error");
    }
    hideLoading();
};
function renderAdminServiceManagementTab() { console.log("Admin Service Management Rendered (Placeholder - implement service listing and form population)"); loadAdminServicesFromFirestore(); /* This calls renderAdminServicesTable */ }
function populateServiceCategoryTypeDropdown() { console.log("Populate Service Category Dropdown (Placeholder - ensure select element exists and is populated)"); }
function renderAdminServiceRateFields() { console.log("Render Admin Service Rate Fields (Placeholder - dynamically show rate inputs based on category)"); }
function clearAdminServiceForm() { console.log("Clear Admin Service Form (Placeholder - reset service form fields)"); }
function renderAdminServicesTable() {
    if (!adminServicesTableBodyElement) return;
    adminServicesTableBodyElement.innerHTML = '';
    adminManagedServices.forEach(service => {
        const row = adminServicesTableBodyElement.insertRow();
        row.innerHTML = `
            <td>${service.serviceCode || 'N/A'}</td>
            <td>${service.description || 'N/A'}</td>
            <td>${service.categoryType || 'N/A'}</td>
            <td>${formatCurrency(service.rates?.weekday || service.rates?.flat || 0)}</td>
            <td>${service.travelCode || 'None'}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="window.editAdminService('${service.id}')"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-danger btn-sm" onclick="window.requestDeleteAdminService('${service.id}', '${service.description}')"><i class="fas fa-trash"></i> Delete</button>
            </td>
        `;
    });
    console.log("[Admin] Services table rendered with", adminManagedServices.length, "services.");
}
window.editAdminService = (id) => { console.log("Edit Admin Service (Placeholder)", id); /* TODO: Populate form with service 'id' data */ };
window.requestDeleteAdminService = (id, description) => {
    showConfirmationModal(
        "Confirm Delete Service",
        `Are you sure you want to delete the NDIS service "${description || id}"? This will remove it globally.`,
        () => executeDeleteAdminService(id)
    );
};
async function executeDeleteAdminService(id) {
    if (!fsDb || !id) { showMessage("Error", "Cannot delete service. System error.", "error"); return; }
    showLoading(`Deleting service ${id}...`);
    try {
        await deleteDoc(doc(fsDb, `artifacts/${appId}/public/services`, id));
        adminManagedServices = adminManagedServices.filter(s => s.id !== id); // Update local cache
        renderAdminServicesTable(); // Re-render table
        showMessage("Service Deleted", `Service ${id} has been deleted.`, "success");
    } catch (error) {
        console.error("Error deleting service:", error);
        logErrorToFirestore("executeDeleteAdminService", error.message, {serviceId: id});
        showMessage("Delete Failed", `Could not delete service ${id}. ${error.message}`, "error");
    } finally {
        hideLoading();
    }
};
async function saveAdminServiceToFirestore() { console.log("Save Admin Service to Firestore (Placeholder - implement form data collection and save logic)"); }
function openTravelCodeSelectionModal() { console.log("Open Travel Code Selection Modal (Placeholder - populate with travel-type services)"); }
function renderAdminAgreementCustomizationTab() { console.log("Admin Agreement Customization Rendered (Placeholder - implement clause editor)"); }
function renderAdminAgreementClausesEditor() { console.log("Render Admin Agreement Clauses Editor (Placeholder)"); }
function addAdminAgreementClauseEditor() { console.log("Add Admin Agreement Clause Editor (Placeholder)"); }
function updateAdminAgreementPreview() { console.log("Update Admin Agreement Preview (Placeholder)"); }
async function saveAdminAgreementCustomizationsToFirestore() { console.log("Save Admin Agreement Customizations (Placeholder)"); }
function renderAdminWorkerManagementTab() { console.log("Admin Worker Management Rendered (Placeholder - implement worker lists)"); loadPendingApprovalWorkers(); loadApprovedWorkersForAuthManagement(); }
async function loadPendingApprovalWorkers() { console.log("Load Pending Approval Workers (Placeholder - fetch and display workers with approved:false)"); }
window.approveWorkerInFirestore = async (uid) => { console.log("Approve Worker (Placeholder)", uid); /* TODO: Set worker's 'approved' field to true */ };
window.denyWorkerInFirestore = async (uid) => { console.log("Deny Worker (Placeholder)", uid); /* TODO: Delete worker profile or mark as denied */ };
async function loadApprovedWorkersForAuthManagement() { console.log("Load Approved Workers (Placeholder - fetch and display approved workers for service auth mgmt)"); }
window.selectWorkerForAuth = (uid, name) => { console.log("Select Worker for Auth (Placeholder)", uid, name); /* TODO: Load selected worker's authorized services */ };
async function saveWorkerAuthorizationsToFirestore() { console.log("Save Worker Authorizations (Placeholder - save checked services to worker's profile)"); }

/* ========== Modal & Wizard Functions (Stubs - to be fully implemented) ========== */
function openUserSetupWizard() { console.log("Open User Setup Wizard (Placeholder - implement wizard steps and data saving)"); openModal('wiz'); /* Assuming 'wiz' is the ID of user setup wizard */ }
function openAdminSetupWizard() { console.log("Open Admin Setup Wizard (Placeholder - implement admin portal setup steps)"); openModal('adminSetupWizard'); }
function navigateWizard(type, step) { console.log("Navigate Wizard (Placeholder)", type, step); /* type: 'user' or 'admin' */ }
function wizardNext(type) { console.log("Wizard Next (Placeholder)", type); }
function wizardPrev(type) { console.log("Wizard Prev (Placeholder)", type); }
async function finishUserWizard() { console.log("Finish User Wizard (Placeholder - save all collected data to user profile)"); }
async function finishAdminWizard() { console.log("Finish Admin Wizard (Placeholder - save all collected global settings)"); }
function openCustomTimePicker(inputElement, callback) { console.log("Open Custom Time Picker (Placeholder - implement time selection UI)"); }


/* ========== Event Listeners Setup ========== */
function setupEventListeners() {
    // Auth
    loginButtonElement?.addEventListener('click', modalLogin);
    registerButtonElement?.addEventListener('click', modalRegister);
    logoutButtonElement?.addEventListener('click', portalSignOut);
    authPasswordInputElement?.addEventListener('keypress', e => { if (e.key === 'Enter') modalLogin(); });

    // Navigation
    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => {
        if (a) a.addEventListener('click', e => { e.preventDefault(); if (a.hash) navigateToSection(a.hash.substring(1)); else console.warn("Navigation link missing hash:", a); });
    });

    // Profile
    editProfileButtonElement?.addEventListener('click', () => openUserSetupWizard()); // Or a simpler edit modal
    uploadProfileDocumentsButtonElement?.addEventListener('click', uploadProfileDocuments);

    // Invoice
    addInvoiceRowButtonElement?.addEventListener('click', addInvRowUserAction);
    saveDraftButtonElement?.addEventListener('click', saveInvoiceDraft);
    generateInvoicePdfButtonElement?.addEventListener('click', generateInvoicePdf);
    saveInitialInvoiceNumberButtonElement?.addEventListener('click', saveInitialInvoiceNumber);
    if(invoiceDateInputElement && invoiceWeekLabelElement) {
        invoiceDateInputElement.addEventListener('change', () => { if (invoiceDateInputElement.value) invoiceWeekLabelElement.textContent = getWeekNumber(new Date(invoiceDateInputElement.value)); });
    }

    // Agreement
    signAgreementButtonElement?.addEventListener('click', () => openSignatureModal('worker'));
    participantSignButtonElement?.addEventListener('click', () => openSignatureModal('participant'));
    downloadAgreementPdfButtonElement?.addEventListener('click', generateAgreementPdf);
    saveSignatureButtonElement?.addEventListener('click', saveSignature);
    closeSignatureModalButtonElement?.addEventListener('click', () => closeModal('sigModal'));
    clearSignatureButtonElement?.addEventListener('click', clearSignaturePad);
    loadServiceAgreementForSelectedWorkerButtonElement?.addEventListener('click', () => {
        if (adminSelectWorkerForAgreementElement && adminSelectWorkerForAgreementElement.value) {
            currentAgreementWorkerEmail = adminSelectWorkerForAgreementElement.value;
            loadAndRenderServiceAgreement(currentAgreementWorkerEmail);
        } else { showMessage("Selection Missing", "Please select a worker to load their agreement.", "warning"); }
    });

    // Admin Tabs
    adminNavTabButtons.forEach(btn => btn.addEventListener('click', () => switchAdminTab(btn.dataset.target)));

    // Admin Global Settings
    saveAdminPortalSettingsButtonElement?.addEventListener('click', saveAdminPortalSettings);
    resetGlobalSettingsToDefaultsButtonElement?.addEventListener('click', requestResetGlobalSettings); // Use request function
    copyInviteLinkButtonElement?.addEventListener('click', () => {
        if (inviteLinkCodeElement && inviteLinkCodeElement.textContent) {
            navigator.clipboard.writeText(inviteLinkCodeElement.textContent)
                .then(() => showMessage("Copied!", "Invite link copied to clipboard.", "success"))
                .catch(err => { console.error("Failed to copy invite link:", err); showMessage("Copy Failed", "Could not copy link. Check browser permissions.", "error"); logErrorToFirestore("copyInviteLink", err.message, err); });
        }
    });

    // Admin Service Management
    saveAdminServiceButtonElement?.addEventListener('click', saveAdminServiceToFirestore);
    clearAdminServiceFormButtonElement?.addEventListener('click', clearAdminServiceForm);
    selectTravelCodeButtonElement?.addEventListener('click', openTravelCodeSelectionModal);
    adminServiceCategoryTypeSelectElement?.addEventListener('change', renderAdminServiceRateFields);
    closeTravelCodeSelectionModalButtonElement?.addEventListener('click', () => closeModal('travelCodeSelectionModal'));
    confirmTravelCodeSelectionButtonElement?.addEventListener('click', () => { /* TODO: Implement logic to confirm and use selected travel code */ closeModal('travelCodeSelectionModal'); });


    // Admin Agreement Customization
    adminAddAgreementClauseButtonElement?.addEventListener('click', addAdminAgreementClauseEditor);
    saveAdminAgreementCustomizationsButtonElement?.addEventListener('click', saveAdminAgreementCustomizationsToFirestore);

    // Admin Worker Management
    saveWorkerAuthorizationsButtonElement?.addEventListener('click', saveWorkerAuthorizationsToFirestore);

    // Modals & Wizards Common Close/Action Buttons
    closeRequestModalButtonElement?.addEventListener('click', () => closeModal('rqModal'));
    saveRequestButtonElement?.addEventListener('click', () => { /* TODO: Add save shift request logic */ closeModal('rqModal'); showMessage("Request Submitted", "Your shift request has been submitted.", "success"); });
    closeLogShiftModalButtonElement?.addEventListener('click', () => closeModal('logShiftModal'));
    saveShiftToInvoiceButtonElement?.addEventListener('click', () => { /* TODO: Add save shift to invoice logic */ closeModal('logShiftModal'); showMessage("Shift Logged", "The shift has been added to your current invoice draft.", "success"); });
    closeMessageModalButtonElement?.addEventListener('click', () => closeModal('messageModal'));
    confirmationModalConfirmBtnElement?.addEventListener('click', () => { if (typeof currentOnConfirmCallback === 'function') currentOnConfirmCallback(); closeModal('confirmationModal'); currentOnConfirmCallback = null; });
    confirmationModalCancelBtnElement?.addEventListener('click', () => { closeModal('confirmationModal'); currentOnConfirmCallback = null; });


    // User Setup Wizard Buttons
    wizardNextButton1Element?.addEventListener('click', () => wizardNext('user'));
    wizardNextButton2Element?.addEventListener('click', () => wizardNext('user'));
    wizardNextButton3Element?.addEventListener('click', () => wizardNext('user'));
    wizardPrevButton2Element?.addEventListener('click', () => wizardPrev('user'));
    wizardPrevButton3Element?.addEventListener('click', () => wizardPrev('user'));
    wizardPrevButton4Element?.addEventListener('click', () => wizardPrev('user'));
    wizardFinishButtonElement?.addEventListener('click', finishUserWizard);
    wizardFilesInputElement?.addEventListener('change', (e) => {
        if (!wizardFilesListElement) return;
        wizardFilesListElement.innerHTML = ''; wizardFileUploads = Array.from(e.target.files);
        if (wizardFileUploads.length > 0) wizardFileUploads.forEach(file => { const li = document.createElement('li'); li.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`; wizardFilesListElement.appendChild(li); });
        else wizardFilesListElement.innerHTML = '<li>No files selected.</li>';
    });

    // Admin Setup Wizard Buttons
    adminWizardNextButton1Element?.addEventListener('click', () => wizardNext('admin'));
    adminWizardNextButton2Element?.addEventListener('click', () => wizardNext('admin'));
    adminWizardPrevButton2Element?.addEventListener('click', () => wizardPrev('admin'));
    adminWizardPrevButton3Element?.addEventListener('click', () => wizardPrev('admin'));
    adminWizardFinishButtonElement?.addEventListener('click', finishAdminWizard);

    // Listen to hash changes for navigation (e.g., browser back/forward)
    window.addEventListener('hashchange', () => { const hash = window.location.hash || '#home'; navigateToSection(hash.substring(1)); });

    // Global keydown listener for Esc to close modals
    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape") $$('.modal').forEach(modal => { if (modal.style.display === 'flex') closeModal(modal.id); });
    });

    console.log("[Events] All primary event listeners set up.");
}

/* ========== App Initialization ========== */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed. App Version 1.1.1");
    showLoading("Initializing Portal...");

    await initializeFirebaseApp(); // This calls setupAuthListener internally
    setupEventListeners(); // Setup all other event listeners

    // Initial navigation is now primarily handled by onAuthStateChanged after auth state is known.
    // A fallback or initial display can be set here if needed before auth resolves, but onAuthStateChanged is more robust.
    if (initialAuthComplete) { // If auth listener already ran (e.g. due to custom token or rapid auth)
        const initialHash = window.location.hash || '#home';
        navigateToSection(initialHash.substring(1));
    } else {
        console.log("Waiting for onAuthStateChanged to complete initial authentication and navigation.");
    }

    // hideLoading() is called within onAuthStateChanged's finally block.
    // This ensures it's hidden only after the initial auth check and data loading attempt.
    // However, if Firebase init itself failed catastrophically before auth listener setup, hide loading here.
    if (loadingOverlayElement.style.display !== "none" && !isFirebaseInitialized) {
        hideLoading();
    }
    console.log("[AppInit] DOMContentLoaded complete. Application is initializing or awaiting authentication.");
});

// Make functions globally accessible if they are called directly from HTML onclick attributes (though direct JS event listeners are preferred).
// window.clearSignaturePad = clearSignaturePad; // Example: if clear button in HTML directly calls this.
// window.deleteInvoiceRow = requestDeleteInvoiceRow; // Changed to request confirmation
// window.confirmDeleteProfileDocument = requestDeleteProfileDocument; // Changed to request confirmation
// window.confirmResetGlobalSettings = requestResetGlobalSettings; // Changed to request confirmation
// window.editAdminService, window.deleteAdminService etc. should be attached via JS if possible, or made global if truly needed by dynamic HTML.

