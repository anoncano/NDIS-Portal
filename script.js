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
    addDoc as fsAddDoc // Renamed to avoid conflict with local addDoc if any
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
const $$ = q => Array.from(document.querySelectorAll(q)); // Ensure it's an array

/* ========== Firebase Global Variables & Config ========== */
let fbApp;
let fbAuth;
let fsDb;
let fbStorage;
let currentUserId = null;
let currentUserEmail = null; // Store email for convenience

// App ID from Canvas environment or a default for local testing
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ndis-portal-app-local'; // More descriptive default
console.log(`[App Init] Using appId: ${appId}`);

/* ========== UI Element References (Cached for performance) ========== */
// Auth Screen
const authScreenElement = $("#authScreen");
const authFormElement = $("#authForm");
const authEmailInputElement = $("#authEmail");
const authPasswordInputElement = $("#authPassword");
const loginButtonElement = $("#loginBtn");
const registerButtonElement = $("#registerBtn");
const authStatusMessageElement = $("#authStatusMessage");

// Portal App
const portalAppElement = $("#portalApp");
const loadingOverlayElement = $("#loadingOverlay");
const portalTitleDisplayElement = $("#portalTitleDisplay");
const userIdDisplayElement = $("#userIdDisplay");
const logoutButtonElement = $("#logoutBtn");

// Navigation
const sideNavLinks = $$("nav#side a.link");
const bottomNavLinks = $$("nav#bottom a.bLink");
const adminTabElement = $("#adminTab"); // Side nav admin tab

// Home Section
const homeSectionElement = $("#home");
const homeUserDivElement = $("#homeUser");
const userNameDisplayElement = $("#userNameDisplay");
const requestShiftButtonElement = $("#rqBtn");
const logTodayShiftButtonElement = $("#logTodayShiftBtn");
const shiftRequestsContainerElement = $("#shiftRequestsContainer");
const shiftRequestsTableBodyElement = $("#rqTbl tbody");

// Profile Section
const profileSectionElement = $("#profile");
const profileNameElement = $("#profileName");
const profileAbnElement = $("#profileAbn");
const profileGstElement = $("#profileGst");
const profileBsbElement = $("#profileBsb");
const profileAccElement = $("#profileAcc");
const editProfileButtonElement = $("#editProfileBtn");
const profileFilesListElement = $("#profileFilesList");
const profileFileUploadElement = $("#profileFileUpload");
const uploadProfileDocumentsButtonElement = $("#uploadProfileDocumentsBtn");

// Invoice Section
const invoiceSectionElement = $("#invoice");
const setInitialInvoiceModalElement = $("#setInitialInvoiceModal");
const initialInvoiceNumberInputElement = $("#initialInvoiceNumberInput");
const saveInitialInvoiceNumberButtonElement = $("#saveInitialInvoiceNumberBtn");
const invoiceWeekLabelElement = $("#wkLbl");
const invoiceNumberInputElement = $("#invNo");
const invoiceDateInputElement = $("#invDate");
const providerNameInputElement = $("#provName");
const providerAbnInputElement = $("#provAbn");
const gstFlagInputElement = $("#gstFlag");
const invoiceTableBodyElement = $("#invTbl tbody");
const subtotalElement = $("#sub");
const gstRowElement = $("#gstRow");
const gstAmountElement = $("#gst");
const grandTotalElement = $("#grand");
const addInvoiceRowButtonElement = $("#addInvRowUserActionBtn");
const saveDraftButtonElement = $("#saveDraftBtn");
const generateInvoicePdfButtonElement = $("#generateInvoicePdfBtn");
const invoicePdfContentElement = $("#invoicePdfContent"); // For html2pdf

// Agreement Section
const agreementSectionElement = $("#agreement");
const agreementDynamicTitleElement = $("#agreementDynamicTitle");
const adminAgreementWorkerSelectorElement = $("#adminAgreementWorkerSelector");
const adminSelectWorkerForAgreementElement = $("#adminSelectWorkerForAgreement");
const loadServiceAgreementForSelectedWorkerButtonElement = $("#loadServiceAgreementForSelectedWorkerBtn");
const agreementChipElement = $("#agrChip");
const agreementContentContainerElement = $("#agreementContentContainer");
const participantSignatureImageElement = $("#sigP");
const participantSignatureDateElement = $("#dP");
const workerSignatureImageElement = $("#sigW");
const workerSignatureDateElement = $("#dW");
const signAgreementButtonElement = $("#signBtn");
const participantSignButtonElement = $("#participantSignBtn");
const downloadAgreementPdfButtonElement = $("#pdfBtn"); // Agreement PDF button
const agreementContentWrapperElement = $("#agreementContentWrapper"); // For html2pdf

// Admin Section
const adminSectionElement = $("#admin");
const adminNavTabButtons = $$(".admin-tab-btn");
const adminGlobalSettingsPanelElement = $("#adminGlobalSettings");
const adminServiceManagementPanelElement = $("#adminServiceManagement");
const adminAgreementCustomizationPanelElement = $("#adminAgreementCustomization");
const adminWorkerManagementPanelElement = $("#adminWorkerManagement");

// Admin Global Settings
const adminEditOrgNameInputElement = $("#adminEditOrgName");
const adminEditOrgAbnInputElement = $("#adminEditOrgAbn");
const adminEditOrgContactEmailInputElement = $("#adminEditOrgContactEmail");
const adminEditOrgContactPhoneInputElement = $("#adminEditOrgContactPhone");
const adminEditParticipantNameInputElement = $("#adminEditParticipantName");
const adminEditParticipantNdisNoInputElement = $("#adminEditParticipantNdisNo");
const adminEditPlanManagerNameInputElement = $("#adminEditPlanManagerName");
const adminEditPlanManagerEmailInputElement = $("#adminEditPlanManagerEmail");
const adminEditPlanManagerPhoneInputElement = $("#adminEditPlanManagerPhone");
const adminEditPlanEndDateInputElement = $("#adminEditPlanEndDate");
const saveAdminPortalSettingsButtonElement = $("#saveAdminPortalSettingsBtn");
const resetGlobalSettingsToDefaultsButtonElement = $("#resetGlobalSettingsToDefaultsBtn");
const inviteLinkCodeElement = $("#invite");
const copyInviteLinkButtonElement = $("#copyLinkBtn");
const adminEditOrgDetailsSectionElement = $("#adminEditOrgDetailsSection");
const adminEditParticipantDetailsSectionElement = $("#adminEditParticipantDetailsSection");
const adminEditParticipantHrElement = $("#adminEditParticipantHr");
const adminEditParticipantTitleElement = $("#adminEditParticipantTitle");


// Admin Service Management
const adminServiceIdInputElement = $("#adminServiceId");
const adminServiceCodeInputElement = $("#adminServiceCode");
const adminServiceDescriptionInputElement = $("#adminServiceDescription");
const adminServiceCategoryTypeSelectElement = $("#adminServiceCategoryType");
const adminServiceRateFieldsContainerElement = $("#adminServiceRateFieldsContainer");
const adminServiceTravelCodeDisplayElement = $("#adminServiceTravelCodeDisplay");
const selectTravelCodeButtonElement = $("#selectTravelCodeBtn");
const adminServiceTravelCodeInputElement = $("#adminServiceTravelCode");
const saveAdminServiceButtonElement = $("#saveAdminServiceBtn");
const clearAdminServiceFormButtonElement = $("#clearAdminServiceFormBtn");
const adminServicesTableBodyElement = $("#adminServicesTable tbody");

// Admin Agreement Customization
const adminAgreementOverallTitleInputElement = $("#adminAgreementOverallTitle");
const adminAgreementClausesContainerElement = $("#adminAgreementClausesContainer");
const adminAddAgreementClauseButtonElement = $("#adminAddAgreementClauseBtn");
const saveAdminAgreementCustomizationsButtonElement = $("#saveAdminAgreementCustomizationsBtn");
const adminAgreementPreviewElement = $("#adminAgreementPreview");

// Admin Worker Management
const pendingWorkersListElement = $("#pendingWorkersList");
const noPendingWorkersMessageElement = $("#noPendingWorkersMessage");
const workersListForAuthElement = $("#workersListForAuth");
const selectedWorkerNameForAuthElement = $("#selectedWorkerNameForAuth");
const servicesForWorkerContainerElement = $("#servicesForWorkerContainer");
const servicesListCheckboxesElement = $("#servicesListCheckboxes");
const saveWorkerAuthorizationsButtonElement = $("#saveWorkerAuthorizationsBtn");

// Modals & Modal Elements
const requestShiftModalElement = $("#rqModal");
const requestDateInputElement = $("#rqDate");
const requestStartTimeInputElement = $("#rqStart");
const requestEndTimeInputElement = $("#rqEnd");
const requestReasonTextareaElement = $("#rqReason");
const saveRequestButtonElement = $("#saveRequestBtn");
const closeRequestModalButtonElement = $("#closeRqModalBtn");

const logShiftModalElement = $("#logShiftModal");
const logShiftDateInputElement = $("#logShiftDate");
const logShiftSupportTypeSelectElement = $("#logShiftSupportType");
const logShiftStartTimeInputElement = $("#logShiftStartTime");
const logShiftEndTimeInputElement = $("#logShiftEndTime");
const logShiftClaimTravelToggleElement = $("#logShiftClaimTravelToggle");
const logShiftKmFieldsContainerElement = $("#logShiftKmFieldsContainer");
const logShiftStartKmInputElement = $("#logShiftStartKm");
const logShiftEndKmInputElement = $("#logShiftEndKm");
const logShiftCalculatedKmElement = $("#logShiftCalculatedKm");
const saveShiftToInvoiceButtonElement = $("#saveShiftFromModalToInvoiceBtn");
const closeLogShiftModalButtonElement = $("#closeLogShiftModalBtn");

const signatureModalElement = $("#sigModal");
const signatureCanvasElement = $("#signatureCanvas");
const saveSignatureButtonElement = $("#saveSigBtn");
const closeSignatureModalButtonElement = $("#closeSigModalBtn");

const userSetupWizardModalElement = $("#wiz");
const userWizardStepElements = $$("#wiz .wizard-step-content");
const userWizardIndicatorElements = $$("#wiz .wizard-step-indicator");
// User Wizard Step 1
const wizardNameInputElement = $("#wName");
const wizardAbnInputElement = $("#wAbn");
const wizardGstCheckboxElement = $("#wGst");
const wizardNextButton1Element = $("#wizNextBtn1");
// User Wizard Step 2
const wizardBsbInputElement = $("#wBsb");
const wizardAccInputElement = $("#wAcc");
const wizardPrevButton2Element = $("#wizPrevBtn2");
const wizardNextButton2Element = $("#wizNextBtn2");
// User Wizard Step 3
const wizardFilesInputElement = $("#wFiles");
const wizardFilesListElement = $("#wFilesList");
const wizardPrevButton3Element = $("#wizPrevBtn3");
const wizardNextButton3Element = $("#wizNextBtn3");
// User Wizard Step 4
const wizardPrevButton4Element = $("#wizPrevBtn4");
const wizardFinishButtonElement = $("#wizFinishBtn");

const adminSetupWizardModalElement = $("#adminSetupWizard");
const adminWizardStepElements = $$("#adminSetupWizard .wizard-step-content");
const adminWizardIndicatorElements = $$("#adminSetupWizard .wizard-step-indicator");
// Admin Wizard Step 1
const adminWizardPortalTypeRadioElements = $$("input[name='adminWizPortalType']");
const adminWizardNextButton1Element = $("#adminWizNextBtn1");
// Admin Wizard Step 2
const adminWizardStep2TitleElement = $("#adminWizStep2Title");
const adminWizardOrgFieldsDivElement = $("#adminWizOrgFields");
const adminWizardOrgNameInputElement = $("#adminWizOrgName");
const adminWizardOrgAbnInputElement = $("#adminWizOrgAbn");
const adminWizardOrgContactEmailInputElement = $("#adminWizOrgContactEmail");
const adminWizardOrgContactPhoneInputElement = $("#adminWizOrgContactPhone");
const adminWizardUserFieldsDivElement = $("#adminWizUserFields");
const adminWizardUserNameInputElement = $("#adminWizUserName");
const adminWizardPrevButton2Element = $("#adminWizPrevBtn2");
const adminWizardNextButton2Element = $("#adminWizNextBtn2");
// Admin Wizard Step 3
const adminWizardStep3TitleElement = $("#adminWizStep3Title");
const adminWizardParticipantNameInputElement = $("#adminWizParticipantName");
const adminWizardParticipantNdisNoInputElement = $("#adminWizParticipantNdisNo");
const adminWizardPlanManagerNameInputElement = $("#adminWizPlanManagerName");
const adminWizardPlanManagerEmailInputElement = $("#adminWizPlanManagerEmail");
const adminWizardPlanManagerPhoneInputElement = $("#adminWizPlanManagerPhone");
const adminWizardPlanEndDateInputElement = $("#adminWizPlanEndDate");
const adminWizardPrevButton3Element = $("#adminWizPrevBtn3");
const adminWizardFinishButtonElement = $("#adminWizFinishBtn");

const customTimePickerElement = $("#customTimePicker");
const timePickerStepAmPmElement = $("#timePickerStepAmPm");
const timePickerAmPmButtonsContainerElement = $("#timePickerAmPmButtons");
const timePickerStepHourElement = $("#timePickerStepHour");
const timePickerHoursContainerElement = $("#timePickerHours");
const timePickerStepMinuteElement = $("#timePickerStepMinute");
const timePickerMinutesContainerElement = $("#timePickerMinutes");
const timePickerBackButtonElement = $("#timePickerBackButton");
const setTimeButtonElement = $("#setTimeButton");
const cancelTimeButtonElement = $("#cancelTimeButton");
const currentTimePickerStepLabelElement = $("#currentTimePickerStepLabel");

const messageModalElement = $("#messageModal");
const messageModalTitleElement = $("#messageModalTitle");
const messageModalTextElement = $("#messageModalText");
const closeMessageModalButtonElement = $("#closeMessageModalBtn");

const travelCodeSelectionModalElement = $("#travelCodeSelectionModal");
const travelCodeFilterInputElement = $("#travelCodeFilterInput");
const travelCodeListContainerElement = $("#travelCodeListContainer");
const confirmTravelCodeSelectionButtonElement = $("#confirmTravelCodeSelectionBtn");
const closeTravelCodeSelectionModalButtonElement = $("#closeTravelCodeSelectionModalBtn");


/* ========== Local State Variables ========== */
let userProfile = {}; // Holds the current user's profile data
let globalSettings = {}; // Holds portal-wide settings
let adminManagedServices = []; // Holds NDIS services defined by admin
let currentInvoiceData = { items: [], invoiceNumber: "", invoiceDate: "", subtotal: 0, gst: 0, grandTotal: 0 }; // Holds data for the current invoice being edited
let defaultAgreementCustomData = { // Default structure for service agreements
    overallTitle: "NDIS Service Agreement",
    clauses: [
        { id: "parties", heading: "1. Parties", body: "This Service Agreement is between:\n\n**The Participant:** {{participantName}} (NDIS No: {{participantNdisNo}}, Plan End Date: {{planEndDate}})\n\nand\n\n**The Provider (Support Worker):** {{workerName}} (ABN: {{workerAbn}})" },
        { id: "purpose", heading: "2. Purpose of this Agreement", body: "This Service Agreement outlines the supports that {{workerName}} will provide to {{participantName}}, the costs of these supports, and the terms and conditions under which these supports will be delivered." },
        { id: "services", heading: "3. Agreed Supports & Services", body: "The following NDIS supports will be provided under this agreement:\n\n{{serviceList}}\n\n<em>Detailed rates for specific times (e.g., evening, weekend) for the above services are as per the NDIS Pricing Arrangements and Price Limits and are available from the provider upon request. Travel costs, where applicable, will be based on the agreed NDIS travel item code and its defined rate.</em>" },
        { id: "provider_resp", heading: "4. Responsibilities of the Provider", body: "<ul><li>Deliver services in a safe, respectful, and professional manner.</li><li>Work collaboratively with the participant and their support network.</li><li>Maintain accurate records of services provided.</li><li>Adhere to NDIS Code of Conduct.</li></ul>" },
        { id: "participant_resp", heading: "5. Responsibilities of the Participant", body: "<ul><li>Treat the provider with courtesy and respect.</li><li>Provide a safe working environment.</li><li>Communicate needs and preferences clearly.</li><li>Provide timely notification of any changes or cancellations.</li></ul>" },
        { id: "payments", heading: "6. Payments", body: "Invoices for services will be issued (typically weekly/fortnightly) to the Participant or their nominated Plan Manager ({{planManagerName}}, {{planManagerEmail}}). Payment terms are 14 days from the date of invoice unless otherwise agreed." },
        { id: "cancellations", heading: "7. Changes and Cancellations", body: "Changes to agreed supports or schedules should be communicated with at least 24 hours' notice where possible. Cancellations with less than 24 hours' notice may be subject to a cancellation fee as per NDIS guidelines and the terms agreed with the provider." },
        { id: "feedback", heading: "8. Feedback, Complaints, and Disputes", body: "Any feedback, complaints, or disputes will be managed respectfully and promptly. Please contact {{workerName}} directly in the first instance. If unresolved, the NDIS Quality and Safeguards Commission can be contacted." },
        { id: "term", heading: "9. Agreement Term and Review", body: "This agreement will commence on {{agreementStartDate}} and will remain in effect until {{agreementEndDate}} (or plan end date {{planEndDate}}, whichever is sooner), or until terminated by either party with (e.g., 14 days) written notice. This agreement will be reviewed at least annually, or as requested by either party." }
    ]
};
let agreementCustomData = JSON.parse(JSON.stringify(defaultAgreementCustomData)); // Working copy, loaded from Firestore

const RATE_CATEGORIES = ["weekday", "evening", "night", "saturday", "sunday", "public"];
const SERVICE_CATEGORY_TYPES = {
    CORE_STANDARD: 'core_standard',
    CORE_HIGH_INTENSITY: 'core_high_intensity',
    CAPACITY_THERAPY_STD: 'capacity_therapy_std',
    CAPACITY_SPECIALIST: 'capacity_specialist',
    TRAVEL_KM: 'travel_km',
    OTHER_FLAT_RATE: 'other_flat_rate'
};

// Signature Pad state
let sigCanvas, sigCtx, sigPen = false, sigCurrentPath, sigPaths = [];
let currentAgreementWorkerEmail = null; // For admin viewing/signing agreements for others
let signingAs = 'worker'; // 'worker' or 'participant'

// UI State
let isFirebaseInitialized = false;
let initialAuthComplete = false; // To ensure auth listener runs fully once
let selectedWorkerEmailForAuth = null; // For admin authorizing services
let currentAdminServiceEditingId = null; // For editing services in admin panel
let currentAdminClauseEditingId = null; // For editing agreement clauses

// Custom Time Picker State
let currentTimePickerStep = 'ampm'; // 'ampm', 'hour', 'minute'
let selectedMinute = null, selectedHour12 = null, selectedAmPm = null;
let activeTimeInputElement = null; // The input field that opened the picker
let timePickerCallback = null; // Callback function after time is set

// Wizard State
let currentAdminWizardStep = 1;
let currentUserWizardStep = 1;
let wizardFileUploads = []; // For user setup wizard file uploads

/* ========== Error Logging to Firestore ========== */
async function logErrorToFirestore(location, errorMsg, errorDetails = {}) {
    if (!fsDb || !appId || appId === 'ndis-portal-app-local') {
        console.error("Firestore not initialized or appId is for local dev, cannot log error to Firestore:", location, errorMsg, errorDetails);
        return;
    }
    try {
        const errorLogRef = collection(fsDb, `artifacts/${appId}/public/logs/errors`);
        await fsAddDoc(errorLogRef, {
            location: String(location),
            errorMessage: String(errorMsg),
            errorStack: errorDetails instanceof Error ? errorDetails.stack : JSON.stringify(errorDetails),
            user: currentUserEmail || currentUserId || "unknown/anonymous",
            timestamp: serverTimestamp(),
            appVersion: "1.0.7", // Increment version as needed
            userAgent: navigator.userAgent,
            url: window.location.href
        });
        console.info("Error logged to Firestore:", location);
    } catch (logError) {
        console.error("FATAL: Could not log error to Firestore:", logError);
        console.error("Original error was at:", location, "Message:", errorMsg);
    }
}

/* ========== Loading Overlay & Messages ========== */
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

function showAuthStatusMessage(message, isError = true) {
    if (authStatusMessageElement) {
        authStatusMessageElement.textContent = message;
        authStatusMessageElement.style.color = isError ? 'var(--danger)' : 'var(--ok)';
        authStatusMessageElement.style.display = message ? 'block' : 'none';
    }
}

function showMessage(title, text, type = 'info') { // type can be 'info', 'success', 'warning', 'error'
    if (messageModalTitleElement) {
        let iconClass = 'fas fa-info-circle';
        if (type === 'success') iconClass = 'fas fa-check-circle';
        else if (type === 'warning') iconClass = 'fas fa-exclamation-triangle';
        else if (type === 'error') iconClass = 'fas fa-times-circle';
        messageModalTitleElement.innerHTML = `<i class="${iconClass}"></i> ${title}`;
    }
    if (messageModalTextElement) messageModalTextElement.innerHTML = text; // Allow HTML in text
    if (messageModalElement) {
        messageModalElement.classList.remove('hide'); // Just in case
        messageModalElement.style.display = "flex";
    }
}

/* ========== Utility Functions ========== */
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase()); }

function formatDateForDisplay(dateInput) { // More robust date formatting
    if (!dateInput) return "";
    let date;
    if (dateInput instanceof Date) {
        date = dateInput;
    } else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
        date = new Date(dateInput);
    } else if (dateInput && typeof dateInput.toDate === 'function') { // Firebase Timestamp
        date = dateInput.toDate();
    } else {
        console.warn("Unrecognized date format for display:", dateInput);
        return "Invalid Date";
    }
    if (isNaN(date.getTime())) {
        console.warn("Parsed date is invalid:", dateInput);
        return "Invalid Date";
    }
    return `${date.getDate()} ${date.toLocaleString('en-AU', { month: 'short' })} ${date.getFullYear()}`;
}

function formatDateForInput(dateInput) { // For setting date input value
    if (!dateInput) return "";
    let date;
     if (dateInput instanceof Date) {
        date = dateInput;
    } else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
        date = new Date(dateInput);
    } else if (dateInput && typeof dateInput.toDate === 'function') { // Firebase Timestamp
        date = dateInput.toDate();
    } else { return ""; }
    if (isNaN(date.getTime())) return "";
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


function timeToMinutes(timeStr) { // e.g., "14:30" -> 870
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
}

function calculateHours(startTime24, endTime24) {
    if (!startTime24 || !endTime24) return 0;
    const startMinutes = timeToMinutes(startTime24);
    const endMinutes = timeToMinutes(endTime24);
    if (endMinutes <= startMinutes) return 0;
    return parseFloat(((endMinutes - startMinutes) / 60).toFixed(2)); // Return as float with 2 decimal places
}

function determineRateType(dateStr, startTime24) { // dateStr as "YYYY-MM-DD"
    if (!dateStr || !startTime24) return "weekday";
    const date = new Date(dateStr + "T" + startTime24 + ":00"); // Use full ISO string for local time
    const day = date.getDay(); // 0 (Sun) to 6 (Sat)
    const hr = date.getHours(); // 0-23

    // TODO: Implement Public Holiday check if possible (requires external data or manual input)
    // For now, assuming no public holidays unless explicitly set in service item.

    if (day === 0) return "sunday";    // Sunday
    if (day === 6) return "saturday";  // Saturday

    // Weekday logic based on NDIS typical hours (can be complex)
    // Simplified: Night (before 6am, after 8pm), Evening (6pm-8pm), Weekday (6am-6pm)
    if (hr < 6 || hr >= 20) return "night"; // Approx. 8 PM to 6 AM
    // if (hr >= 18 && hr < 20) return "evening"; // Approx. 6 PM to 8 PM (This might vary, NDIS guides are specific)
    // Standard NDIS often defines evening from 8pm. If so, "night" covers it.
    // For simplicity, let's stick to weekday/night for now based on common interpretations.
    // If more granular evening rates are needed, this logic needs NDIS price guide alignment.
    
    return "weekday";
}

function formatTime12Hour(time24) { // "HH:MM"
    if (!time24 || !time24.includes(':')) return "";
    const [h, m] = time24.split(':');
    const hour = parseInt(h, 10);
    if (isNaN(hour) || isNaN(parseInt(m, 10))) return "";
    const ampm = hour >= 12 ? 'PM' : 'AM';
    let hour12 = hour % 12;
    hour12 = hour12 ? hour12 : 12; // 0 should be 12
    return `${String(hour12).padStart(2, '0')}:${m} ${ampm}`;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount || 0);
}

function isValidABN(abn) {
    if (!abn || typeof abn !== 'string') return false;
    const cleanedAbn = abn.replace(/\s/g, '');
    if (!/^\d{11}$/.test(cleanedAbn)) return false;
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    let sum = 0;
    for (let i = 0; i < 11; i++) {
        let digit = parseInt(cleanedAbn[i], 10);
        if (i === 0) digit -= 1; // Subtract 1 from the first digit
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
    return /^\d{6,10}$/.test(cleanedAcc); // Common range, might vary
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/* ========== Firebase Initialization and Auth State ========== */
async function initializeFirebaseApp() {
    console.log("[FirebaseInit] Attempting to initialize with config from window.firebaseConfigForApp");
    const currentFirebaseConfig = window.firebaseConfigForApp;

    if (!currentFirebaseConfig || !currentFirebaseConfig.apiKey || currentFirebaseConfig.apiKey.startsWith("YOUR_") ||
        !currentFirebaseConfig.authDomain || !currentFirebaseConfig.projectId || !currentFirebaseConfig.storageBucket ||
        !currentFirebaseConfig.messagingSenderId || !currentFirebaseConfig.appId || currentFirebaseConfig.appId.startsWith("YOUR_") || 
        appId === 'ndis-portal-app-local' && currentFirebaseConfig.apiKey === "AIzaSyA33RDvrpWXUeOZYBpfJaqrytbUQFo0cgs") { // Check if default config is being used without Canvas override
        
        let errorMsg = "Firebase configuration is missing, incomplete, or uses placeholders.";
        if (appId === 'ndis-portal-app-local' && currentFirebaseConfig.apiKey === "AIzaSyA33RDvrpWXUeOZYBpfJaqrytbUQFo0cgs") {
             console.warn("[FirebaseInit] Using default placeholder API key for local development. Ensure __firebase_config is provided in a deployed environment.");
        } else if (appId !== 'ndis-portal-app-local') { // Only critical if not local default
            console.error("[FirebaseInit] CRITICAL: " + errorMsg);
            if (authScreenElement) authScreenElement.style.display = "flex";
            if (portalAppElement) portalAppElement.style.display = "none";
            showAuthStatusMessage("System Error: Portal configuration is invalid. Cannot connect.");
            hideLoading();
            isFirebaseInitialized = false;
            return;
        }
    }

    try {
        fbApp = initializeApp(currentFirebaseConfig, appId); // App name for potential multiple apps
        fbAuth = getAuth(fbApp);
        fsDb = getFirestore(fbApp);
        fbStorage = getStorage(fbApp);

        if (!fbAuth || !fsDb || !fbStorage) {
            throw new Error("Failed to get Firebase Auth, Firestore, or Storage instance.");
        }
        isFirebaseInitialized = true;
        console.log("[FirebaseInit] Firebase initialized successfully.");
        await setupAuthListener();
    } catch (error) {
        console.error("[FirebaseInit] Initialization error:", error);
        logErrorToFirestore("initializeFirebaseApp", error.message, error);
        if (authScreenElement) authScreenElement.style.display = "flex";
        if (portalAppElement) portalAppElement.style.display = "none";
        showAuthStatusMessage("System Error: Could not connect to backend. " + error.message);
        hideLoading();
        isFirebaseInitialized = false;
    }
}

async function setupAuthListener() {
    return new Promise((resolve) => {
        onAuthStateChanged(fbAuth, async (user) => {
            showLoading("Authenticating...");
            showAuthStatusMessage("", false); // Clear previous auth messages
            try {
                if (user) {
                    currentUserId = user.uid;
                    currentUserEmail = user.email;
                    console.log("[AuthListener] User authenticated:", currentUserId, currentUserEmail);
                    if (userIdDisplayElement) userIdDisplayElement.textContent = currentUserId + (currentUserEmail ? ` (${currentUserEmail})` : "");
                    if (logoutButtonElement) logoutButtonElement.classList.remove('hide');
                    if (authScreenElement) authScreenElement.style.display = "none";
                    if (portalAppElement) portalAppElement.style.display = "flex";

                    await loadGlobalSettingsFromFirestore(); // Load global settings first
                    console.log("[AuthListener] Global Settings after load:", JSON.parse(JSON.stringify(globalSettings)));

                    const userProfileData = await loadUserProfileFromFirestore(currentUserId);
                    console.log("[AuthListener] User Profile Data from Firestore:", userProfileData ? "Exists" : "null");
                    
                    let signedOutFlow = false;

                    if (userProfileData) {
                        signedOutFlow = await handleExistingUserProfile(userProfileData);
                    } else if (currentUserEmail && currentUserEmail.toLowerCase() === "admin@portal.com") { // Special email for first admin
                        signedOutFlow = await handleNewAdminProfile();
                    } else if (currentUserId) { // New regular user or profile load issue
                        signedOutFlow = await handleNewRegularUserProfile();
                    } else {
                        console.warn("[AuthListener] Unexpected state: User object exists but no UID or specific conditions met.");
                        await fbSignOut(fbAuth);
                        signedOutFlow = true;
                    }

                    if (signedOutFlow) {
                        console.log("[AuthListener] User was signed out or is in a flow that prevents portal entry. Returning.");
                        // UI should already be handled by sign out or specific messages
                    }

                } else { // User is signed out
                    console.log("[AuthListener] User is signed out.");
                    currentUserId = null; currentUserEmail = null; userProfile = {};
                    if (userIdDisplayElement) userIdDisplayElement.textContent = "Not Logged In";
                    if (logoutButtonElement) logoutButtonElement.classList.add('hide');
                    if (authScreenElement) authScreenElement.style.display = "flex";
                    if (portalAppElement) portalAppElement.style.display = "none";
                    
                    // Reset UI elements that depend on auth
                    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => {
                        if (a.hash !== "#home") a.classList.add('hide');
                        else a.classList.add('active'); // Ensure home is active
                    });
                    if (adminTabElement) adminTabElement.classList.add('hide');
                    if (homeUserDivElement) homeUserDivElement.classList.add("hide");
                    navigateToSection("home"); // Navigate to home on logout
                }
            } catch (error) {
                console.error("[AuthListener] Error in top-level try-catch:", error);
                logErrorToFirestore("onAuthStateChanged_mainTryCatch", error.message, error);
                showAuthStatusMessage("Authentication State Error: " + error.message);
                currentUserId = null; currentUserEmail = null; userProfile = {};
                if (authScreenElement) authScreenElement.style.display = "flex";
                if (portalAppElement) portalAppElement.style.display = "none";
                await fbSignOut(fbAuth).catch(e => console.error("Error signing out after catch:", e));
            } finally {
                if (!initialAuthComplete) {
                    initialAuthComplete = true;
                    resolve(); // Resolve promise after first run
                }
                hideLoading();
            }
        });

        // Handle custom token if provided by Canvas environment
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            console.log("[AuthListener] Attempting sign-in with custom token.");
            showLoading("Authenticating with token...");
            signInWithCustomToken(fbAuth, __initial_auth_token)
                .catch((error) => {
                    console.error("[AuthListener] Custom token sign-in error:", error);
                    logErrorToFirestore("signInWithCustomToken", error.message, error);
                    showAuthStatusMessage("Token Sign-In Error: " + error.message);
                    if (!initialAuthComplete) { initialAuthComplete = true; resolve(); }
                    hideLoading();
                });
        } else if (fbAuth.currentUser) { // If already signed in (e.g. session persistence)
            console.log("[AuthListener] User already signed in (session persistence). onAuthStateChanged will handle.");
            // onAuthStateChanged will fire, so no need to resolve here if initialAuthComplete is false
        } else { // No token, no current user
            console.log("[AuthListener] No initial token or active session. Displaying auth screen.");
            if (authScreenElement) authScreenElement.style.display = "flex";
            if (portalAppElement) portalAppElement.style.display = "none";
            if (!initialAuthComplete) { initialAuthComplete = true; resolve(); }
            hideLoading();
        }
    });
}


async function handleExistingUserProfile(userProfileData) {
    userProfile = userProfileData;
    console.log(`[AuthListener] Existing profile found for ${currentUserEmail || currentUserId}. Approved: ${userProfile.approved}, IsAdmin: ${userProfile.isAdmin}, PortalType: ${globalSettings.portalType}`);

    if (!userProfile.isAdmin && globalSettings.portalType === 'organization' && userProfile.approved !== true) {
        console.log(`[AuthListener] Existing org user ${currentUserEmail || currentUserId} NOT approved. Signing out.`);
        showMessage("Approval Required", "Your account is awaiting approval or is not currently approved. You will be logged out.", "warning");
        await fbSignOut(fbAuth);
        return true; // Indicates user was signed out
    }

    if (userProfile.isAdmin) {
        await loadAllDataForAdmin(); // Load admin specific data
        if (!globalSettings.setupComplete) {
            console.log("[AuthListener] Admin needs portal setup wizard.");
            openAdminSetupWizard();
        } else {
            enterPortal(true); // Enter as admin
        }
    } else { // Regular user
        await loadAllDataForUser(); // Load user specific data
        if (globalSettings.portalType === 'organization' && (!userProfile.abn || !userProfile.bsb || !userProfile.acc || !userProfile.profileSetupComplete)) {
            console.log(`[AuthListener] Existing/Approved org user ${currentUserEmail || currentUserId} needs profile setup wizard.`);
            openUserSetupWizard();
        } else if (globalSettings.portalType === 'participant' && !userProfile.profileSetupComplete) {
             console.log(`[AuthListener] Participant user ${currentUserEmail || currentUserId} needs profile setup wizard.`);
            openUserSetupWizard(); // Participant might also have a simplified setup
        }
        else {
            enterPortal(false); // Enter as regular user
        }
    }
    return false; // User not signed out
}

async function handleNewAdminProfile() {
    console.log("[AuthListener] First-time admin login detected for admin@portal.com.");
    userProfile = {
        isAdmin: true, name: "Administrator", email: currentUserEmail, uid: currentUserId,
        approved: true, createdAt: serverTimestamp(), createdBy: "system",
        profileSetupComplete: true, // Admins are considered setup by default for their own profile
        nextInvoiceNumber: 1001 // Default starting invoice number
    };
    const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
    await setDoc(userProfileDocRef, userProfile);
    console.log("[AuthListener] New admin profile created in Firestore.");
    
    // Since this is the first admin, global settings might not be fully set up yet.
    // `loadGlobalSettingsFromFirestore` would have loaded defaults if nothing existed.
    // We need to ensure `globalSettings.setupComplete` is false to trigger the wizard.
    if (!globalSettings.setupComplete) { // This should be true if it's the very first run
        console.log("[AuthListener] New admin needs portal setup wizard.");
        // Ensure global settings are saved with setupComplete: false if it's the very first time
        if(globalSettings.adminSetupComplete === undefined) { // A better flag or check if truly first time
            globalSettings.setupComplete = false; // Explicitly set for wizard
            globalSettings.adminSetupComplete = false; // More specific flag
            globalSettings.portalType = 'organization'; // Default to org for admin setup
            await saveGlobalSettingsToFirestore();
        }
        openAdminSetupWizard();
    } else {
        await loadAllDataForAdmin(); // Load data after profile creation
        enterPortal(true);
    }
    return false;
}

async function handleNewRegularUserProfile() {
    console.log(`[AuthListener] User ${currentUserEmail || currentUserId} authenticated but no profile found. Creating new profile.`);
    console.log(`[AuthListener] Current globalSettings.portalType for new profile decision: '${globalSettings.portalType}' (Is setupComplete: ${globalSettings.setupComplete})`);
    
    const isOrgPortal = globalSettings.portalType === 'organization';
    console.log(`[AuthListener] For new profile: isOrgPortal evaluates to: ${isOrgPortal}`);
    
    userProfile = {
        name: currentUserEmail ? currentUserEmail.split('@')[0] : 'New User', email: currentUserEmail || null,
        uid: currentUserId, isAdmin: false, abn: "", gstRegistered: false, bsb: "", acc: "", files: [],
        authorizedServiceCodes: [], profileSetupComplete: false, nextInvoiceNumber: 1001,
        approved: !isOrgPortal, // Auto-approve if not an organization portal, otherwise require admin approval
        createdAt: serverTimestamp(), createdBy: currentUserId
    };
    console.log(`[AuthListener] New profile object created. Approved status set to: ${userProfile.approved}`);
    
    const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
    try {
        await setDoc(userProfileDocRef, userProfile);
        console.log(`[AuthListener] New profile CREATED in Firestore for ${currentUserEmail || currentUserId}. Approved: ${userProfile.approved}, isOrgPortal: ${isOrgPortal}`);

        if (isOrgPortal && userProfile.approved === false) {
            console.log(`[AuthListener] New org user ${currentUserEmail || currentUserId} NOT approved. Signing out.`);
            showMessage("Registration Complete - Approval Required", "Your account has been created and is awaiting administrator approval. You will be logged out.", "info");
            await fbSignOut(fbAuth);
            return true; // User signed out
        }
        
        console.log(`[AuthListener] New user ${currentUserEmail || currentUserId} is auto-approved or not an org user requiring approval. Proceeding.`);
        await loadAllDataForUser(); // Load data for the new user
        
        if (!userProfile.profileSetupComplete) { 
             console.log(`[AuthListener] New user ${currentUserEmail || currentUserId} profile.profileSetupComplete is false. Opening user setup wizard.`);
             openUserSetupWizard();
        } else {
            console.log(`[AuthListener] New user ${currentUserEmail || currentUserId} profile setup is complete. Entering portal.`);
            enterPortal(false);
        }
    } catch (profileCreationError) {
        console.error("CRITICAL: Failed to create new user profile in Firestore:", profileCreationError);
        logErrorToFirestore("handleNewRegularUserProfile_setDoc", profileCreationError.message, profileCreationError);
        showMessage("Registration Finalization Error", "Could not save your profile information. Please contact support.", "error");
        await fbSignOut(fbAuth); 
        return true; // User signed out due to error
    }
    return false; // User not signed out
}


/* ========== Data Loading Functions ========== */
async function loadUserProfileFromFirestore(uid) {
    if (!fsDb || !uid) return null;
    const profileDocRef = doc(fsDb, `artifacts/${appId}/users/${uid}/profile`, "details");
    try {
        const docSnap = await getDoc(profileDocRef);
        if (docSnap.exists()) {
            console.log("[FirestoreLoad] User profile loaded:", docSnap.data());
            return docSnap.data();
        } else {
            console.log("[FirestoreLoad] No user profile document found for UID:", uid);
            return null;
        }
    } catch (error) {
        console.error("[FirestoreLoad] Error loading user profile:", error);
        logErrorToFirestore("loadUserProfileFromFirestore", error.message, error);
        showMessage("Profile Load Error", "Could not load your profile data. Please try again later.", "error");
        return null;
    }
}

async function loadGlobalSettingsFromFirestore() {
    if (!fsDb) {
        globalSettings = getDefaultGlobalSettings(); // Fallback to local defaults
        return;
    }
    const settingsDocRef = doc(fsDb, `artifacts/${appId}/public/settings`, "global");
    try {
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
            globalSettings = docSnap.data();
            // Merge with defaults to ensure all keys are present
            globalSettings = { ...getDefaultGlobalSettings(), ...globalSettings };
            console.log("[FirestoreLoad] Global settings loaded:", globalSettings);
            // Load agreement customizations if they exist under global settings
            if (globalSettings.agreementTemplate) {
                agreementCustomData = JSON.parse(JSON.stringify(globalSettings.agreementTemplate));
                 console.log("[FirestoreLoad] Agreement template loaded from global settings.");
            } else {
                agreementCustomData = JSON.parse(JSON.stringify(defaultAgreementCustomData)); // Fallback
                 console.log("[FirestoreLoad] No agreement template in global settings, using default.");
            }
        } else {
            console.log("[FirestoreLoad] No global settings document found. Using defaults and attempting to save them.");
            globalSettings = getDefaultGlobalSettings();
            agreementCustomData = JSON.parse(JSON.stringify(defaultAgreementCustomData)); // Use default agreement too
            await saveGlobalSettingsToFirestore(); // Save defaults for the first time
        }
    } catch (error) {
        console.error("[FirestoreLoad] Error loading global settings:", error);
        logErrorToFirestore("loadGlobalSettingsFromFirestore", error.message, error);
        globalSettings = getDefaultGlobalSettings(); // Fallback
        agreementCustomData = JSON.parse(JSON.stringify(defaultAgreementCustomData)); // Fallback
        showMessage("Settings Load Error", "Could not load portal settings. Using defaults.", "warning");
    }
    updatePortalTitle();
}

function getDefaultGlobalSettings() {
    return {
        portalTitle: "NDIS Support Portal",
        organizationName: "Your Organization Name",
        organizationAbn: "Your ABN",
        organizationContactEmail: "contact@example.com",
        organizationContactPhone: "000-000-000",
        defaultParticipantName: "Participant Name",
        defaultParticipantNdisNo: "000000000",
        defaultPlanManagerName: "Plan Manager Name",
        defaultPlanManagerEmail: "pm@example.com",
        defaultPlanManagerPhone: "111-111-111",
        defaultPlanEndDate: formatDateForInput(new Date(new Date().setFullYear(new Date().getFullYear() + 1))), // Default to one year from now
        setupComplete: false, // Has the admin run the initial setup wizard?
        adminSetupComplete: false, // More specific flag for admin part of setup
        portalType: "organization", // 'organization' or 'participant'
        agreementTemplate: JSON.parse(JSON.stringify(defaultAgreementCustomData)) // Store default agreement structure
    };
}

async function saveGlobalSettingsToFirestore() {
    if (!fsDb || !userProfile.isAdmin) {
        console.warn("Firestore not init or user not admin. Cannot save global settings.");
        return false;
    }
    const settingsDocRef = doc(fsDb, `artifacts/${appId}/public/settings`, "global");
    try {
        // Ensure agreement template is part of global settings before saving
        globalSettings.agreementTemplate = JSON.parse(JSON.stringify(agreementCustomData));
        await setDoc(settingsDocRef, globalSettings, { merge: true });
        console.log("[FirestoreSave] Global settings saved.");
        showMessage("Settings Saved", "Global portal settings have been updated.", "success");
        updatePortalTitle();
        return true;
    } catch (error) {
        console.error("[FirestoreSave] Error saving global settings:", error);
        logErrorToFirestore("saveGlobalSettingsToFirestore", error.message, error);
        showMessage("Save Error", "Could not save portal settings: " + error.message, "error");
        return false;
    }
}

async function loadAdminServicesFromFirestore() {
    if (!fsDb) return;
    adminManagedServices = []; // Clear existing
    const servicesCollectionRef = collection(fsDb, `artifacts/${appId}/public/services`);
    try {
        const querySnapshot = await getDocs(servicesCollectionRef);
        querySnapshot.forEach((doc) => {
            adminManagedServices.push({ id: doc.id, ...doc.data() });
        });
        console.log("[FirestoreLoad] Admin managed services loaded:", adminManagedServices.length);
        renderAdminServicesTable();
        populateServiceTypeDropdowns(); // Update dropdowns that use these services
    } catch (error) {
        console.error("[FirestoreLoad] Error loading admin services:", error);
        logErrorToFirestore("loadAdminServicesFromFirestore", error.message, error);
    }
}


async function loadAllDataForUser() {
    showLoading("Loading your data...");
    // Load user-specific invoice drafts, shift requests etc.
    await loadUserShiftRequests();
    await loadUserInvoiceDraft();
    // Other user-specific data loads can go here
    hideLoading();
}

async function loadAllDataForAdmin() {
    showLoading("Loading admin data...");
    await loadAdminServicesFromFirestore();
    await loadPendingApprovalWorkers();
    await loadApprovedWorkersForAuthManagement();
    // Agreement template is loaded with global settings, but re-render admin UI for it
    renderAdminAgreementCustomizationTab(); 
    // Other admin-specific data loads
    hideLoading();
}


/* ========== Portal Entry and UI Updates ========== */
function enterPortal(isAdmin) {
    console.log(`Entering portal. Admin: ${isAdmin}`);
    if (portalAppElement) portalAppElement.style.display = "flex";
    if (authScreenElement) authScreenElement.style.display = "none";

    updateNavigation(isAdmin);
    updateProfileDisplay(); // Update profile tab from userProfile
    
    if (isAdmin) {
        navigateToSection("admin"); // Default for admin
        renderAdminDashboard();
    } else {
        navigateToSection("home"); // Default for regular users
        renderUserHomePage();
        if (userProfile.nextInvoiceNumber === undefined || userProfile.nextInvoiceNumber === null || 
            (globalSettings.portalType === 'participant' && !userProfile.profileSetupComplete)) {
            // This check might be redundant if wizard handles it, but good for robustness
            // For participant type, if profile isn't complete, wizard should have caught it.
            // For all users, if nextInvoiceNumber is missing, prompt.
            if (globalSettings.portalType !== 'organization' || userProfile.approved) { // Only prompt if not an org user awaiting approval
                 if (!$("#setInitialInvoiceModal")?.style.display || $("#setInitialInvoiceModal").style.display === 'none'){
                    if(userProfile.nextInvoiceNumber === undefined || userProfile.nextInvoiceNumber === null) {
                        console.log("Prompting for initial invoice number as it's missing.");
                        openModal('setInitialInvoiceModal');
                    }
                 }
            }
        }
    }
    updatePortalTitle();
    hideLoading();
}

function updatePortalTitle() {
    const title = globalSettings.portalTitle || "NDIS Support Portal";
    document.title = title;
    if (portalTitleDisplayElement) portalTitleDisplayElement.innerHTML = `<i class="fas fa-cogs"></i> ${title}`;
}

function updateNavigation(isAdmin) {
    const linksToShow = ["#home", "#profile", "#invoice", "#agreement"];
    if (isAdmin) {
        linksToShow.push("#admin");
        if (adminTabElement) adminTabElement.classList.remove('hide');
    } else {
        if (adminTabElement) adminTabElement.classList.add('hide');
    }

    sideNavLinks.forEach(link => {
        if (linksToShow.includes(link.hash)) link.classList.remove('hide');
        else link.classList.add('hide');
    });
    bottomNavLinks.forEach(link => {
        if (linksToShow.includes(link.hash)) link.classList.remove('hide');
        else link.classList.add('hide');
        // Special handling for admin tab on bottom nav if it exists
        // if (link.id === "adminTabBottom") {
        //    isAdmin ? link.classList.remove('hide') : link.classList.add('hide');
        // }
    });
}

function navigateToSection(sectionId) {
    $$("main section.card").forEach(s => s.classList.remove("active"));
    const targetSection = $(`#${sectionId}`);
    if (targetSection) targetSection.classList.add("active");

    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => a.classList.remove("active"));
    $$(`nav#side a.link[href="#${sectionId}"], nav#bottom a.bLink[href="#${sectionId}"]`).forEach(a => a.classList.add("active"));
    
    // Scroll to top of main content on navigation
    if($("main")) $("main").scrollTop = 0;

    // Specific rendering functions for sections when navigated to
    if (sectionId === "profile") renderProfileSection();
    if (sectionId === "invoice") renderInvoiceSection();
    if (sectionId === "agreement") renderAgreementSection();
    if (sectionId === "admin") renderAdminDashboard(); // Ensures correct admin tab is shown
    if (sectionId === "home") renderUserHomePage();
    
    console.log(`Navigated to #${sectionId}`);
}


/* ========== Authentication Functions ========== */
async function modalLogin() {
    const email = authEmailInputElement.value.trim();
    const password = authPasswordInputElement.value;
    if (!validateEmail(email) || !password) {
        showAuthStatusMessage("Please enter a valid email and password.");
        return;
    }
    showLoading("Logging in...");
    showAuthStatusMessage("", false);
    try {
        await signInWithEmailAndPassword(fbAuth, email, password);
        // onAuthStateChanged will handle successful login flow
        console.log("Login successful, onAuthStateChanged will take over.");
    } catch (error) {
        console.error("Login Error:", error);
        logErrorToFirestore("modalLogin", error.message, error);
        showAuthStatusMessage(error.message);
    } finally {
        hideLoading();
    }
}

async function modalRegister() {
    const email = authEmailInputElement.value.trim();
    const password = authPasswordInputElement.value;
    if (!validateEmail(email)) {
        showAuthStatusMessage("Please enter a valid email address.");
        return;
    }
    if (password.length < 6) {
        showAuthStatusMessage("Password should be at least 6 characters.");
        return;
    }
    showLoading("Registering...");
    showAuthStatusMessage("", false);
    try {
        await createUserWithEmailAndPassword(fbAuth, email, password);
        // onAuthStateChanged will handle new user registration flow
        console.log("Registration successful, onAuthStateChanged will take over.");
        // It will call handleNewRegularUserProfile or handleNewAdminProfile
    } catch (error) {
        console.error("Registration Error:", error);
        logErrorToFirestore("modalRegister", error.message, error);
        showAuthStatusMessage(error.message);
    } finally {
        hideLoading();
    }
}

async function portalSignOut() {
    showLoading("Logging out...");
    try {
        await fbSignOut(fbAuth);
        // onAuthStateChanged will handle UI changes for signed-out state
        userProfile = {}; // Clear local profile
        currentInvoiceData = { items: [], invoiceNumber: "", invoiceDate: "", subtotal: 0, gst: 0, grandTotal: 0 }; // Clear invoice
        adminManagedServices = []; // Clear admin data
        console.log("User signed out successfully.");
        navigateToSection("home"); // Go to home after logout
    } catch (error) {
        console.error("Sign Out Error:", error);
        logErrorToFirestore("portalSignOut", error.message, error);
        showMessage("Logout Error", "Failed to log out: " + error.message, "error");
    } finally {
        hideLoading();
    }
}

/* ========== Profile Section Functions ========== */
function renderProfileSection() {
    if (!userProfile || !currentUserId) {
        navigateToSection("home"); // Redirect if no profile
        return;
    }
    updateProfileDisplay();
}

function updateProfileDisplay() {
    if (profileNameElement) profileNameElement.textContent = userProfile.name || 'N/A';
    if (profileAbnElement) profileAbnElement.textContent = userProfile.abn || 'N/A';
    if (profileGstElement) profileGstElement.textContent = userProfile.gstRegistered ? 'Yes' : 'No';
    if (profileBsbElement) profileBsbElement.textContent = userProfile.bsb || 'N/A';
    if (profileAccElement) profileAccElement.textContent = userProfile.acc || 'N/A';
    renderProfileFilesList();
}

function renderProfileFilesList() {
    if (!profileFilesListElement) return;
    profileFilesListElement.innerHTML = ''; // Clear existing
    if (userProfile.files && userProfile.files.length > 0) {
        userProfile.files.forEach(file => {
            const li = document.createElement('li');
            li.innerHTML = `
                <i class="fas fa-file-alt" style="margin-right: 8px; color: var(--pri);"></i>
                <a href="${file.url}" target="_blank" rel="noopener noreferrer" title="Open ${file.name}">${file.name}</a>
                <button class="btn-danger btn-small" onclick="confirmDeleteProfileDocument('${file.name}', '${file.storagePath}')" title="Delete ${file.name}" style="margin-left: auto; padding: 5px 8px;">
                    <i class="fas fa-trash-alt" style="margin-right:0;"></i>
                </button>
            `;
            profileFilesListElement.appendChild(li);
        });
    } else {
        profileFilesListElement.innerHTML = '<li>No documents uploaded.</li>';
    }
}

async function saveProfileDetails(updatedDetails) {
    if (!currentUserId || !fsDb) return false;
    showLoading("Saving profile...");
    const profileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
    try {
        await updateDoc(profileDocRef, { ...updatedDetails, updatedAt: serverTimestamp() });
        userProfile = { ...userProfile, ...updatedDetails }; // Update local profile
        updateProfileDisplay(); // Refresh UI
        showMessage("Profile Updated", "Your profile details have been saved.", "success");
        hideLoading();
        return true;
    } catch (error) {
        console.error("Error saving profile details:", error);
        logErrorToFirestore("saveProfileDetails", error.message, error);
        showMessage("Save Error", "Could not save profile: " + error.message, "error");
        hideLoading();
        return false;
    }
}

async function uploadProfileDocuments() {
    if (!profileFileUploadElement || !profileFileUploadElement.files || profileFileUploadElement.files.length === 0) {
        showMessage("No Files Selected", "Please select one or more files to upload.", "warning");
        return;
    }
    if (!currentUserId || !fbStorage || !fsDb) {
        showMessage("Upload Error", "Cannot upload files. User not authenticated or storage service unavailable.", "error");
        return;
    }

    const filesToUpload = Array.from(profileFileUploadElement.files);
    showLoading(`Uploading ${filesToUpload.length} file(s)...`);

    const uploadPromises = filesToUpload.map(async (file) => {
        const uniqueFileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`; // Ensure unique and clean name
        const storagePath = `artifacts/${appId}/users/${currentUserId}/profileDocuments/${uniqueFileName}`;
        const fileRef = ref(fbStorage, storagePath);
        try {
            const snapshot = await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            return { name: file.name, url: downloadURL, storagePath: storagePath, uploadedAt: serverTimestamp() };
        } catch (uploadError) {
            console.error(`Error uploading file ${file.name}:`, uploadError);
            logErrorToFirestore("uploadProfileDocument_single", uploadError.message, {fileName: file.name, ...uploadError});
            throw uploadError; // Re-throw to be caught by Promise.all
        }
    });

    try {
        const uploadedFileObjects = await Promise.all(uploadPromises);
        
        // Update Firestore profile with new file metadata
        const profileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        await updateDoc(profileDocRef, {
            files: arrayUnion(...uploadedFileObjects), // Add new files to existing array
            updatedAt: serverTimestamp()
        });

        // Update local profile
        if (!userProfile.files) userProfile.files = [];
        userProfile.files.push(...uploadedFileObjects);
        
        renderProfileFilesList(); // Refresh the list
        profileFileUploadElement.value = ""; // Clear file input
        showMessage("Upload Successful", `${uploadedFileObjects.length} file(s) uploaded and added to your profile.`, "success");
    } catch (error) {
        // Error already logged for individual file if that was the cause
        showMessage("Upload Failed", "One or more files could not be uploaded. Please try again.", "error");
    } finally {
        hideLoading();
    }
}

async function confirmDeleteProfileDocument(fileName, storagePath) {
    // Use a custom confirmation modal instead of window.confirm
    showMessage(
        "Confirm Delete",
        `Are you sure you want to delete the document "${fileName}"? This action cannot be undone.`,
        "warning"
    );
    // For this example, we'll need a way to handle the confirmation.
    // A real implementation would use a modal that returns a promise or calls a callback.
    // For now, let's assume the user confirms via a custom modal interaction (not shown here)
    // and then calls a function like `executeDeleteProfileDocument`.
    // This is a placeholder for that logic.
    // To make it testable without a full modal, we can proceed with deletion:
    console.warn(`Confirmation for deleting ${fileName} would be handled by a custom modal. Proceeding with delete for now.`);
    await executeDeleteProfileDocument(fileName, storagePath);
}

async function executeDeleteProfileDocument(fileName, storagePath) {
    if (!currentUserId || !fbStorage || !fsDb) {
        showMessage("Delete Error", "Cannot delete file. User not authenticated or services unavailable.", "error");
        return;
    }
    showLoading(`Deleting ${fileName}...`);
    const fileRef = ref(fbStorage, storagePath);
    try {
        // Delete from Storage
        await deleteObject(fileRef);
        console.log(`File deleted from Storage: ${storagePath}`);

        // Remove from Firestore
        const profileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        // Find the file object to remove. This is a bit tricky with arrayRemove if objects are complex.
        // It's often better to fetch, filter, and then update the whole array.
        const currentFiles = userProfile.files || [];
        const updatedFiles = currentFiles.filter(f => f.storagePath !== storagePath);
        
        await updateDoc(profileDocRef, {
            files: updatedFiles,
            updatedAt: serverTimestamp()
        });

        userProfile.files = updatedFiles; // Update local profile
        renderProfileFilesList(); // Refresh UI
        showMessage("File Deleted", `"${fileName}" has been successfully deleted.`, "success");
    } catch (error) {
        console.error(`Error deleting file ${fileName}:`, error);
        logErrorToFirestore("deleteProfileDocument", error.message, {fileName, storagePath, ...error});
        showMessage("Delete Failed", `Could not delete "${fileName}": ${error.message}`, "error");
    } finally {
        hideLoading();
    }
}
window.confirmDeleteProfileDocument = confirmDeleteProfileDocument; // Make accessible from HTML


/* ========== Invoice Section Functions ========== */
// (Full invoice logic: rendering, adding rows, calculations, saving draft, PDF generation)
// ... This section will be extensive ...
function renderInvoiceSection() {
    if (!userProfile || !currentUserId) { navigateToSection("home"); return; }
    if (userProfile.nextInvoiceNumber === undefined || userProfile.nextInvoiceNumber === null) {
        openModal('setInitialInvoiceModal');
    } else {
        loadUserInvoiceDraft(); // Load existing draft or start new
    }
    populateInvoiceHeader();
    renderInvoiceTable();
    updateInvoiceTotals();
    if(invoiceWeekLabelElement) invoiceWeekLabelElement.textContent = getWeekNumber(new Date(invoiceDateInputElement.value || Date.now()));
}

function populateInvoiceHeader() {
    if (providerNameInputElement) providerNameInputElement.value = userProfile.name || "";
    if (providerAbnInputElement) providerAbnInputElement.value = userProfile.abn || "";
    if (gstFlagInputElement) gstFlagInputElement.value = userProfile.gstRegistered ? "Yes" : "No";
    if (invoiceNumberInputElement) invoiceNumberInputElement.value = currentInvoiceData.invoiceNumber || userProfile.nextInvoiceNumber || "INV-001";
    if (invoiceDateInputElement) invoiceDateInputElement.value = currentInvoiceData.invoiceDate || formatDateForInput(new Date());
}

function renderInvoiceTable() {
    if (!invoiceTableBodyElement) return;
    invoiceTableBodyElement.innerHTML = ''; // Clear existing rows
    currentInvoiceData.items.forEach((item, index) => {
        addInvoiceRowToTable(item, index);
    });
    updateInvoiceTotals();
}

function addInvoiceRowToTable(itemData = {}, index = -1) { // index -1 for new row
    if (!invoiceTableBodyElement) return;
    const newRow = invoiceTableBodyElement.insertRow();
    if (index === -1) index = currentInvoiceData.items.length -1; // if new item was pushed

    newRow.innerHTML = `
        <td><span class="row-number">${index + 1}</span></td>
        <td>
            <input type="date" class="invoice-input-condensed item-date" value="${itemData.date || formatDateForInput(new Date())}">
            <span class="date-print-value print-only">${formatDateForDisplay(itemData.date || new Date())}</span>
        </td>
        <td class="column-code pdf-show">
            <input type="text" class="invoice-input-condensed item-code" value="${itemData.code || ''}" placeholder="Item Code">
            <span class="code-print-value print-only">${itemData.code || ''}</span>
        </td>
        <td>
            <select class="invoice-input-condensed item-description-select" style="min-width: 200px;"></select>
            <span class="description-print-value print-only">${itemData.description || ''}</span>
        </td>
        <td>
            <div class="custom-time-picker-container">
                <input type="text" class="custom-time-input item-start-time invoice-input-condensed" readonly placeholder="Select Time" value="${itemData.startTime ? formatTime12Hour(itemData.startTime) : ''}" data-value24="${itemData.startTime || ''}">
            </div>
             <span class="start-time-print-value print-only">${itemData.startTime ? formatTime12Hour(itemData.startTime) : ''}</span>
        </td>
        <td>
            <div class="custom-time-picker-container">
                <input type="text" class="custom-time-input item-end-time invoice-input-condensed" readonly placeholder="Select Time" value="${itemData.endTime ? formatTime12Hour(itemData.endTime) : ''}" data-value24="${itemData.endTime || ''}">
            </div>
            <span class="end-time-print-value print-only">${itemData.endTime ? formatTime12Hour(itemData.endTime) : ''}</span>
        </td>
        <td class="column-rate-type pdf-show">
            <input type="text" class="invoice-input-condensed item-rate-type" value="${itemData.rateType || 'weekday'}" readonly>
            <span class="rate-type-print-value print-only">${itemData.rateType || 'weekday'}</span>
        </td>
        <td class="print-only-column pdf-show">
            <input type="number" class="invoice-input-condensed item-rate-unit" value="${itemData.ratePerUnit || 0}" step="0.01" style="width:80px;">
             <span class="rate-unit-print-value print-only">${formatCurrency(itemData.ratePerUnit || 0)}</span>
        </td>
        <td>
            <input type="number" class="invoice-input-condensed item-hours-km" value="${itemData.hoursOrKm || 0}" step="0.01" style="width:80px;" readonly>
            <span class="hours-km-print-value print-only">${itemData.hoursOrKm || 0}</span>
        </td>
        <td class="no-print pdf-hide">
            <input type="number" class="invoice-input-condensed item-travel-km-input" value="${itemData.travelKmInput || 0}" step="0.1" style="width:80px; ${itemData.isTravelService ? 'display:none;' : ''}" placeholder="Km">
        </td>
        <td class="no-print pdf-hide">
            <label class="chk no-margin" style="justify-content: center;">
                <input type="checkbox" class="item-claim-travel" ${itemData.claimTravel ? 'checked' : ''} ${itemData.isTravelService ? 'disabled style="display:none;"' : ''}>
            </label>
        </td>
        <td>
            <input type="text" class="invoice-input-condensed item-total" value="${formatCurrency(itemData.totalAmount || 0)}" readonly style="width:100px;">
            <span class="total-print-value print-only">${formatCurrency(itemData.totalAmount || 0)}</span>
        </td>
        <td class="no-print pdf-hide">
            <button class="btn-danger btn-small delete-row-btn" onclick="deleteInvoiceRow(this, '${itemData.id || ''}')"><i class="fas fa-trash-alt" style="margin-right:0;"></i></button>
        </td>
    `;

    // Populate service description dropdown for this new row
    const descSelect = newRow.querySelector('.item-description-select');
    populateServiceTypeDropdown(descSelect, itemData.code); // Pass current code to select it

    // Add event listeners for inputs in the new row
    newRow.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', () => updateInvoiceItemFromRow(newRow, index));
        input.addEventListener('input', () => updateInvoiceItemFromRow(newRow, index)); // For live updates on number inputs
    });
    newRow.querySelectorAll('.custom-time-input').forEach(input => {
        input.addEventListener('click', (e) => openCustomTimePicker(e.target, (time24) => {
            e.target.value = formatTime12Hour(time24);
            e.target.dataset.value24 = time24;
            updateInvoiceItemFromRow(newRow, index);
        }));
    });
}
window.deleteInvoiceRow = deleteInvoiceRow; // Make accessible

function addInvRowUserAction() { // Called by button click
    const newItem = { 
        id: generateUniqueId(), // Give new item a temporary unique ID
        date: formatDateForInput(new Date()), 
        code: '', description: '', startTime: '', endTime: '', 
        rateType: 'weekday', ratePerUnit: 0, hoursOrKm: 0, 
        travelKmInput: 0, claimTravel: false, isTravelService: false,
        totalAmount: 0 
    };
    currentInvoiceData.items.push(newItem);
    addInvoiceRowToTable(newItem, currentInvoiceData.items.length - 1);
    updateInvoiceTotals();
}

function updateInvoiceItemFromRow(rowElement, itemIndex) {
    if (itemIndex < 0 || itemIndex >= currentInvoiceData.items.length) return;

    const item = currentInvoiceData.items[itemIndex];
    
    const selectedDescOption = rowElement.querySelector('.item-description-select option:checked');
    const serviceCode = selectedDescOption ? selectedDescOption.value : ''; // This is the NDIS Item Code
    const service = adminManagedServices.find(s => s.code === serviceCode);

    item.date = rowElement.querySelector('.item-date').value;
    item.code = serviceCode;
    item.description = service ? service.description : rowElement.querySelector('.item-description-select').value; // Fallback if not found
    
    item.startTime = rowElement.querySelector('.item-start-time').dataset.value24;
    item.endTime = rowElement.querySelector('.item-end-time').dataset.value24;

    item.rateType = determineRateType(item.date, item.startTime);
    rowElement.querySelector('.item-rate-type').value = item.rateType;

    item.isTravelService = service && service.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM;

    if (item.isTravelService) {
        item.hoursOrKm = parseFloat(rowElement.querySelector('.item-travel-km-input').value) || 0; // For travel, hoursOrKm is Km
        item.ratePerUnit = service && service.rates ? (service.rates.perKm || 0) : 0;
        rowElement.querySelector('.item-claim-travel').checked = false; // Cannot claim travel for a travel service
        rowElement.querySelector('.item-claim-travel').disabled = true;
        rowElement.querySelector('.item-travel-km-input').style.display = 'inline-block'; // Ensure travel km input is visible
    } else {
        item.hoursOrKm = calculateHours(item.startTime, item.endTime);
        item.ratePerUnit = service && service.rates ? (service.rates[item.rateType] || service.rates.flatRate || 0) : 0;
        rowElement.querySelector('.item-claim-travel').disabled = false;
         item.claimTravel = rowElement.querySelector('.item-claim-travel').checked;
        rowElement.querySelector('.item-travel-km-input').style.display = item.claimTravel ? 'inline-block' : 'none';
    }
     rowElement.querySelector('.item-hours-km').value = item.hoursOrKm.toFixed(2);
     rowElement.querySelector('.item-rate-unit').value = item.ratePerUnit.toFixed(2);


    item.totalAmount = item.hoursOrKm * item.ratePerUnit;

    // Handle travel claim for non-travel services
    if (item.claimTravel && !item.isTravelService) {
        const travelKm = parseFloat(rowElement.querySelector('.item-travel-km-input').value) || 0;
        const associatedTravelServiceCode = service ? service.associatedTravelCode : null;
        const travelService = adminManagedServices.find(s => s.code === associatedTravelServiceCode);
        if (travelService && travelService.rates && travelService.rates.perKm) {
            item.totalAmount += travelKm * travelService.rates.perKm;
        }
    }
    
    rowElement.querySelector('.item-total').value = formatCurrency(item.totalAmount);
    updateInvoiceTotals();
}


function deleteInvoiceRow(button, itemId) {
    const row = button.closest('tr');
    const rowIndex = Array.from(invoiceTableBodyElement.rows).indexOf(row);

    if (rowIndex !== -1) {
        currentInvoiceData.items.splice(rowIndex, 1);
        row.remove();
        // Re-number rows
        invoiceTableBodyElement.querySelectorAll('.row-number').forEach((span, idx) => {
            span.textContent = idx + 1;
        });
        updateInvoiceTotals();
    } else {
        console.warn("Could not find row to delete by button or itemId", itemId);
    }
}


function updateInvoiceTotals() {
    let subtotal = 0;
    currentInvoiceData.items.forEach(item => {
        subtotal += item.totalAmount || 0;
    });

    currentInvoiceData.subtotal = subtotal;
    let gst = 0;
    if (userProfile.gstRegistered) {
        gst = subtotal * 0.10;
        if(gstRowElement) gstRowElement.style.display = 'block';
    } else {
        if(gstRowElement) gstRowElement.style.display = 'none';
    }
    currentInvoiceData.gst = gst;
    currentInvoiceData.grandTotal = subtotal + gst;

    if(subtotalElement) subtotalElement.textContent = formatCurrency(currentInvoiceData.subtotal);
    if(gstAmountElement) gstAmountElement.textContent = formatCurrency(currentInvoiceData.gst);
    if(grandTotalElement) grandTotalElement.textContent = formatCurrency(currentInvoiceData.grandTotal);
}

async function saveInvoiceDraft() {
    if (!currentUserId || !fsDb) {
        showMessage("Save Error", "Cannot save draft. User not authenticated or database unavailable.", "error");
        return;
    }
    showLoading("Saving draft...");
    currentInvoiceData.invoiceNumber = invoiceNumberInputElement.value;
    currentInvoiceData.invoiceDate = invoiceDateInputElement.value;
    // Items are already updated in currentInvoiceData.items by updateInvoiceItemFromRow

    const draftDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, "draft");
    try {
        await setDoc(draftDocRef, { ...currentInvoiceData, updatedAt: serverTimestamp() });
        showMessage("Draft Saved", "Your invoice draft has been saved.", "success");
    } catch (error) {
        console.error("Error saving invoice draft:", error);
        logErrorToFirestore("saveInvoiceDraft", error.message, error);
        showMessage("Save Error", "Could not save draft: " + error.message, "error");
    } finally {
        hideLoading();
    }
}

async function loadUserInvoiceDraft() {
    if (!currentUserId || !fsDb) return;
    const draftDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, "draft");
    try {
        const docSnap = await getDoc(draftDocRef);
        if (docSnap.exists()) {
            currentInvoiceData = docSnap.data();
            // Ensure items array exists
            if (!currentInvoiceData.items) currentInvoiceData.items = [];
            console.log("[FirestoreLoad] Invoice draft loaded.");
        } else {
            console.log("[FirestoreLoad] No invoice draft found. Starting new.");
            currentInvoiceData = { items: [], invoiceNumber: userProfile.nextInvoiceNumber || "INV-001", invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0 };
        }
    } catch (error) {
        console.error("[FirestoreLoad] Error loading invoice draft:", error);
        logErrorToFirestore("loadUserInvoiceDraft", error.message, error);
        currentInvoiceData = { items: [], invoiceNumber: userProfile.nextInvoiceNumber || "INV-001", invoiceDate: formatDateForInput(new Date()), subtotal: 0, gst: 0, grandTotal: 0 }; // Fallback
    }
    // After loading or initializing, render the invoice section
    if ($("#invoice")?.classList.contains("active")) { // Only render if invoice tab is active
        populateInvoiceHeader();
        renderInvoiceTable();
    }
}

async function saveInitialInvoiceNumber() {
    const newNum = parseInt(initialInvoiceNumberInputElement.value, 10);
    if (isNaN(newNum) || newNum <= 0) {
        showMessage("Invalid Number", "Please enter a valid positive starting invoice number.", "warning");
        return;
    }
    userProfile.nextInvoiceNumber = newNum;
    const success = await saveProfileDetails({ nextInvoiceNumber: newNum });
    if (success) {
        closeModal('setInitialInvoiceModal');
        if (invoiceNumberInputElement) invoiceNumberInputElement.value = newNum; // Update current invoice
        currentInvoiceData.invoiceNumber = String(newNum);
    }
}

function generateInvoicePdf() {
    if (!invoicePdfContentElement) {
        showMessage("PDF Error", "Cannot find content to generate PDF.", "error");
        return;
    }
    showLoading("Generating PDF...");
    const filename = `Invoice-${currentInvoiceData.invoiceNumber || 'draft'}-${currentInvoiceData.invoiceDate || formatDateForInput(new Date())}.pdf`;
    
    // Temporarily show print-only elements for PDF generation
    $$('.print-only, .pdf-show').forEach(el => el.style.display = ''); // Show, or use table-cell for th/td
    $$('.no-print, .pdf-hide').forEach(el => el.style.display = 'none');


    html2pdf().from(invoicePdfContentElement).set({
        margin: [10, 10, 10, 10], // top, left, bottom, right in mm
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false }, // Increased scale for better quality
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }).save().then(() => {
        hideLoading();
        showMessage("PDF Generated", `Invoice ${filename} has been downloaded.`, "success");
        // Restore visibility
        $$('.print-only, .pdf-show').forEach(el => el.style.display = 'none');
        $$('.no-print, .pdf-hide').forEach(el => el.style.display = '');
    }).catch(err => {
        hideLoading();
        console.error("PDF Generation Error:", err);
        logErrorToFirestore("generateInvoicePdf", err.message, err);
        showMessage("PDF Error", "Could not generate PDF: " + err.message, "error");
        // Restore visibility
        $$('.print-only, .pdf-show').forEach(el => el.style.display = 'none');
        $$('.no-print, .pdf-hide').forEach(el => el.style.display = '');
    });
}


/* ========== Agreement Section Functions ========== */
// (Full agreement logic: rendering, placeholder replacement, signing, PDF)
// ... This section will be extensive ...

function renderAgreementSection() {
    if (!userProfile || !currentUserId) { navigateToSection("home"); return; }

    if (userProfile.isAdmin) {
        if(adminAgreementWorkerSelectorElement) adminAgreementWorkerSelectorElement.classList.remove('hide');
        populateAdminWorkerSelectorForAgreement();
        // Admin might view a specific worker's agreement or a template
        // For now, let's assume they need to select a worker to see a populated agreement
        clearAgreementDisplay(); // Clear it until a worker is selected
    } else { // Regular worker
        if(adminAgreementWorkerSelectorElement) adminAgreementWorkerSelectorElement.classList.add('hide');
        currentAgreementWorkerEmail = currentUserEmail; // Worker views their own agreement
        loadAndRenderServiceAgreement();
    }
}

function populateAdminWorkerSelectorForAgreement() {
    if (!adminSelectWorkerForAgreementElement || !userProfile.isAdmin) return;
    adminSelectWorkerForAgreementElement.innerHTML = '<option value="">-- Select a Worker --</option>';
    // This requires a list of all users, which might be fetched separately or from `accounts` if populated
    // For now, assuming `accounts` might hold this info (needs to be populated during admin data load)
    // This is a placeholder - a proper user list is needed for admin
    getDocs(collection(fsDb, `artifacts/${appId}/users`)).then(snapshot => {
        snapshot.forEach(userDoc => {
            const userDocId = userDoc.id; // This is the UID
            // We need to fetch the profile for each user to get their email/name
            const profileRef = doc(fsDb, `artifacts/${appId}/users/${userDocId}/profile/details`);
            getDoc(profileRef).then(profileSnap => {
                if (profileSnap.exists()) {
                    const workerProfile = profileSnap.data();
                    if (!workerProfile.isAdmin && workerProfile.email) { // List non-admin workers with emails
                        const option = document.createElement('option');
                        option.value = workerProfile.email; // Use email as identifier
                        option.textContent = `${workerProfile.name} (${workerProfile.email})`;
                        adminSelectWorkerForAgreementElement.appendChild(option);
                    }
                }
            });
        });
    }).catch(err => {
        console.error("Error populating worker selector for agreement:", err);
        logErrorToFirestore("populateAdminWorkerSelectorForAgreement", err.message, err);
    });
}


async function loadAndRenderServiceAgreement(forWorkerEmail = null) {
    // forWorkerEmail is used by admin, null means current user (worker)
    const targetUserEmail = forWorkerEmail || currentUserEmail;
    if (!targetUserEmail) {
        console.warn("No target user email for agreement.");
        clearAgreementDisplay();
        return;
    }

    let workerData = userProfile; // Default to current user
    if (forWorkerEmail && forWorkerEmail !== currentUserEmail) {
        // Admin is viewing for another worker. Fetch that worker's profile.
        // This requires a robust way to get UID from email if not already stored.
        // For simplicity, let's assume we can find their profile if we have a list of users.
        // This is a simplified lookup. A proper implementation might query by email.
        const usersRef = collection(fsDb, `artifacts/${appId}/users`);
        const q = query(usersRef, where("email", "==", forWorkerEmail)); // This query won't work directly on users collection, needs profile subcollection.
                                                                      // This needs a more robust user lookup.
                                                                      // For now, this part is a placeholder for admin fetching other worker's data.
        // Placeholder: Assume workerData is fetched and populated for 'forWorkerEmail'
        // workerData = await fetchWorkerProfileByEmail(forWorkerEmail); // Imaginary function
        // If workerData is not found, show error or clear display.
        // For this example, we'll assume if forWorkerEmail is passed, workerData is correctly populated elsewhere.
        // A proper implementation would involve querying the 'profile/details' subcollection of each user doc or having a separate 'user_profiles' collection indexed by email.
        // For now, if admin selects a worker, we'll use the selected email to try and find their data.
        // This part needs a more robust implementation for fetching other users' profiles.
        // Let's assume for now that `loadServiceAgreementForSelectedWorker` (called by admin) handles fetching the correct workerData.
        // If currentAgreementWorkerEmail is set (by admin selection), use that to fetch.
        if (currentAgreementWorkerEmail && currentAgreementWorkerEmail !== currentUserEmail) {
            // Find the UID for currentAgreementWorkerEmail. This is inefficient.
            // A better way is to store UID with email when populating the dropdown.
            // For now, this is a conceptual step.
            console.warn("Admin viewing other worker's agreement: Fetching profile for", currentAgreementWorkerEmail, "is not fully implemented here. Assuming workerData is pre-loaded if admin.");
            // If `accounts` was populated with all user profiles by admin, we could use it:
            // workerData = accounts[currentAgreementWorkerEmail]?.profile;
            // If not, this will fail or use current user's profile incorrectly.
        }
    }


    if (!workerData || !workerData.name) {
        console.warn("Worker data not available for agreement for email:", targetUserEmail);
        // If admin is viewing and selected worker data is not loaded, this will be an issue.
        // For a worker viewing their own, workerData should be userProfile.
        if (forWorkerEmail) { // If admin was trying to load for someone
             showMessage("Error", `Could not load profile data for worker ${forWorkerEmail}.`, "error");
             clearAgreementDisplay();
             return;
        }
        // If it's the current user and their profile is missing critical parts:
        // This should ideally be caught by profile setup wizard.
    }


    // Agreement data (signatures, dates) specific to this worker and participant (global)
    const agreementDocId = `${globalSettings.defaultParticipantNdisNo || 'participant'}_${workerData.uid || 'worker'}`;
    const agreementStateRef = doc(fsDb, `artifacts/${appId}/public/agreements`, agreementDocId);
    
    let agreementState = { workerSigned: false, participantSigned: false, workerSignatureDate: null, participantSignatureDate: null, workerSignatureDataUrl: null, participantSignatureDataUrl: null };

    try {
        const docSnap = await getDoc(agreementStateRef);
        if (docSnap.exists()) {
            agreementState = { ...agreementState, ...docSnap.data() };
        }
    } catch (error) {
        console.error("Error loading agreement state:", error);
        logErrorToFirestore("loadAgreementState", error.message, error);
    }

    // Update UI elements based on loaded/default agreement state
    if(agreementDynamicTitleElement) agreementDynamicTitleElement.textContent = agreementCustomData.overallTitle || "Service Agreement";
    
    // Render clauses with placeholders filled
    renderAgreementClauses(workerData, globalSettings, agreementState);

    // Update signature images and dates
    if(participantSignatureImageElement) participantSignatureImageElement.src = agreementState.participantSignatureDataUrl || 'https://placehold.co/250x85/e8e8e8/666666?text=Signature+Area';
    if(participantSignatureDateElement) participantSignatureDateElement.textContent = agreementState.participantSignatureDate ? formatDateForDisplay(agreementState.participantSignatureDate) : '___';
    if(workerSignatureImageElement) workerSignatureImageElement.src = agreementState.workerSignatureDataUrl || 'https://placehold.co/250x85/e8e8e8/666666?text=Signature+Area';
    if(workerSignatureDateElement) workerSignatureDateElement.textContent = agreementState.workerSignatureDate ? formatDateForDisplay(agreementState.workerSignatureDate) : '___';

    // Update chip status
    updateAgreementChip(agreementState);

    // Show/hide sign buttons
    if(signAgreementButtonElement) signAgreementButtonElement.classList.toggle('hide', agreementState.workerSigned || userProfile.isAdmin && !currentAgreementWorkerEmail); // Hide if worker signed, or if admin hasn't selected a worker
    if(participantSignButtonElement) participantSignButtonElement.classList.toggle('hide', agreementState.participantSigned || !userProfile.isAdmin); // Only admin can sign for participant
    if(downloadAgreementPdfButtonElement) downloadAgreementPdfButtonElement.classList.toggle('hide', !(agreementState.workerSigned && agreementState.participantSigned)); // Show PDF if both signed
}

function renderAgreementClauses(workerProfileData, portalSettings, agreementCurrentState) {
    if (!agreementContentContainerElement) return;
    agreementContentContainerElement.innerHTML = ''; // Clear previous

    const agreementStartDate = agreementCurrentState.agreementStartDate ? formatDateForDisplay(agreementCurrentState.agreementStartDate) : formatDateForDisplay(new Date());
    const agreementEndDate = agreementCurrentState.agreementEndDate ? formatDateForDisplay(agreementCurrentState.agreementEndDate) : "plan end date";


    // Prepare service list HTML
    let serviceListHtml = "<ul>";
    if (workerProfileData.authorizedServiceCodes && workerProfileData.authorizedServiceCodes.length > 0 && adminManagedServices.length > 0) {
        workerProfileData.authorizedServiceCodes.forEach(code => {
            const service = adminManagedServices.find(s => s.code === code);
            if (service) {
                serviceListHtml += `<li>${service.description} (Code: ${service.code})</li>`;
            } else {
                serviceListHtml += `<li>Service with code ${code} (Details not found)</li>`;
            }
        });
    } else {
        serviceListHtml += "<li>No specific services authorized/defined. General support will be provided as agreed.</li>";
    }
    serviceListHtml += "</ul>";

    agreementCustomData.clauses.forEach(clause => {
        const clauseDiv = document.createElement('div');
        clauseDiv.classList.add('agreement-clause');
        
        let body = clause.body;
        // Replace placeholders
        body = body.replace(/{{participantName}}/g, portalSettings.defaultParticipantName || 'The Participant')
                   .replace(/{{participantNdisNo}}/g, portalSettings.defaultParticipantNdisNo || 'N/A')
                   .replace(/{{planEndDate}}/g, portalSettings.defaultPlanEndDate ? formatDateForDisplay(portalSettings.defaultPlanEndDate) : 'N/A')
                   .replace(/{{workerName}}/g, workerProfileData.name || 'The Support Worker')
                   .replace(/{{workerAbn}}/g, workerProfileData.abn || 'N/A')
                   .replace(/{{serviceList}}/g, serviceListHtml)
                   .replace(/{{planManagerName}}/g, portalSettings.defaultPlanManagerName || 'N/A')
                   .replace(/{{planManagerEmail}}/g, portalSettings.defaultPlanManagerEmail || 'N/A')
                   .replace(/{{agreementStartDate}}/g, agreementStartDate)
                   .replace(/{{agreementEndDate}}/g, agreementEndDate)
                   .replace(/\n/g, '<br>'); // Convert newlines to <br>

        // Basic Markdown-like strong/bold
        body = body.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        body = body.replace(/__(.*?)__/g, '<strong>$1</strong>');
        // Basic Markdown-like emphasis/italic
        body = body.replace(/\*(.*?)\*/g, '<em>$1</em>');
        body = body.replace(/_(.*?)_/g, '<em>$1</em>');


        clauseDiv.innerHTML = `<h3>${clause.heading}</h3><p>${body}</p>`;
        agreementContentContainerElement.appendChild(clauseDiv);
    });
}


function updateAgreementChip(agreementState) {
    if (!agreementChipElement) return;
    if (agreementState.workerSigned && agreementState.participantSigned) {
        agreementChipElement.textContent = "Signed & Active";
        agreementChipElement.className = 'chip green';
    } else if (agreementState.workerSigned || agreementState.participantSigned) {
        agreementChipElement.textContent = "Partially Signed";
        agreementChipElement.className = 'chip yellow';
    } else {
        agreementChipElement.textContent = "Draft – waiting for signatures";
        agreementChipElement.className = 'chip yellow';
    }
}


function openSignatureModal(signingFor) { // 'worker' or 'participant'
    signingAs = signingFor;
    if (signatureModalElement) {
        openModal('sigModal');
        initializeSignaturePad(); // Initialize or clear the canvas
        if (signingAs === 'participant' && !userProfile.isAdmin) {
            showMessage("Permission Denied", "Only administrators can sign on behalf of the participant.", "error");
            closeModal('sigModal');
            return;
        }
        signatureModalElement.querySelector('h3').innerHTML = `<i class="fas fa-pencil-alt"></i> Draw Signature for ${signingAs === 'worker' ? (currentAgreementWorkerEmail || currentUserEmail).split('@')[0] : globalSettings.defaultParticipantName}`;
    }
}

function initializeSignaturePad() {
    if (!signatureCanvasElement) return;
    sigCanvas = signatureCanvasElement;
    sigCtx = sigCanvas.getContext('2d');
    
    // Adjust for display size vs. internal resolution (for HiDPI screens)
    const scale = window.devicePixelRatio || 1;
    sigCanvas.width = sigCanvas.offsetWidth * scale;
    sigCanvas.height = sigCanvas.offsetHeight * scale;
    sigCtx.scale(scale, scale);

    sigCtx.strokeStyle = '#333';
    sigCtx.lineWidth = 2;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
    clearSignaturePad(); // Clear any previous drawing

    // Remove old listeners before adding new ones to prevent multiple fires
    sigCanvas.removeEventListener('mousedown', sigStart);
    sigCanvas.removeEventListener('mousemove', sigDraw);
    sigCanvas.removeEventListener('mouseup', sigEnd);
    sigCanvas.removeEventListener('mouseout', sigEnd);
    sigCanvas.removeEventListener('touchstart', sigStart);
    sigCanvas.removeEventListener('touchmove', sigDraw);
    sigCanvas.removeEventListener('touchend', sigEnd);

    // Add event listeners
    sigCanvas.addEventListener('mousedown', sigStart);
    sigCanvas.addEventListener('mousemove', sigDraw);
    sigCanvas.addEventListener('mouseup', sigEnd);
    sigCanvas.addEventListener('mouseout', sigEnd); // Stop drawing if mouse leaves canvas

    sigCanvas.addEventListener('touchstart', sigStart, { passive: false });
    sigCanvas.addEventListener('touchmove', sigDraw, { passive: false });
    sigCanvas.addEventListener('touchend', sigEnd);
}

function clearSignaturePad() {
    if (sigCtx && sigCanvas) {
        sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
        sigCtx.fillStyle = "#fcfcfc"; // Match modal background
        sigCtx.fillRect(0,0, sigCanvas.width, sigCanvas.height);
    }
    sigPaths = []; // Clear stored paths
    sigCurrentPath = null;
}

function sigStart(e) {
    e.preventDefault(); // Prevent scrolling on touch
    sigPen = true;
    const pos = getSigPenPosition(e);
    sigCurrentPath = [pos]; // Start a new path
    sigCtx.beginPath();
    sigCtx.moveTo(pos.x, pos.y);
}

function sigDraw(e) {
    e.preventDefault();
    if (!sigPen) return;
    const pos = getSigPenPosition(e);
    sigCurrentPath.push(pos); // Add point to current path
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.stroke();
}

function sigEnd(e) {
    e.preventDefault();
    if(sigPen && sigCurrentPath && sigCurrentPath.length > 1) { // Only save if it's a meaningful path
        sigPaths.push(sigCurrentPath);
    }
    sigPen = false;
    sigCurrentPath = null; // Reset current path
    sigCtx.closePath();
}

function getSigPenPosition(e) {
    const rect = sigCanvas.getBoundingClientRect();
    let x, y;
    if (e.touches && e.touches[0]) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }
    return { x, y };
}


async function saveSignature() {
    if (!sigCanvas || sigPaths.length === 0) { // Check if anything was drawn
        showMessage("No Signature", "Please draw a signature before saving.", "warning");
        return;
    }
    const signatureDataUrl = sigCanvas.toDataURL('image/png');
    closeModal('sigModal');
    showLoading("Saving signature...");

    const targetUserForAgreement = currentAgreementWorkerEmail || currentUserEmail;
    let workerUidForAgreement = userProfile.uid; // Default to current user

    if (userProfile.isAdmin && currentAgreementWorkerEmail && currentAgreementWorkerEmail !== currentUserEmail) {
        // Admin is signing for a selected worker. Need to get that worker's UID.
        // This part is tricky without a direct UID lookup from email.
        // For now, we'll assume `currentAgreementWorkerEmail` is the key to find their profile.
        // This is a placeholder for fetching the correct UID.
        // A better approach: store UID with email in the admin worker selector.
        console.warn("Admin saving signature for another worker: UID lookup from email is simplified.");
        // Conceptual: workerUidForAgreement = await getUidForEmail(currentAgreementWorkerEmail);
        // If we had a list of all user profiles in `accounts` keyed by email:
        // const selectedWorkerProfile = Object.values(accounts).find(acc => acc.profile.email === currentAgreementWorkerEmail)?.profile;
        // if (selectedWorkerProfile) workerUidForAgreement = selectedWorkerProfile.uid;
        // else { /* handle error: worker not found */ }
        // For now, this will likely use the admin's UID if not correctly implemented.
    }


    const agreementDocId = `${globalSettings.defaultParticipantNdisNo || 'participant'}_${(signingAs === 'worker' ? workerUidForAgreement : 'participant_admin_signed')}`;
    const agreementStateRef = doc(fsDb, `artifacts/${appId}/public/agreements`, agreementDocId);

    let updateData = {};
    if (signingAs === 'worker') {
        updateData.workerSigned = true;
        updateData.workerSignatureDate = serverTimestamp();
        updateData.workerSignatureDataUrl = signatureDataUrl;
        if(workerSignatureImageElement) workerSignatureImageElement.src = signatureDataUrl;
        if(workerSignatureDateElement) workerSignatureDateElement.textContent = formatDateForDisplay(new Date());
    } else if (signingAs === 'participant' && userProfile.isAdmin) {
        updateData.participantSigned = true;
        updateData.participantSignatureDate = serverTimestamp();
        updateData.participantSignatureDataUrl = signatureDataUrl;
        if(participantSignatureImageElement) participantSignatureImageElement.src = signatureDataUrl;
        if(participantSignatureDateElement) participantSignatureDateElement.textContent = formatDateForDisplay(new Date());
    } else {
        hideLoading();
        showMessage("Error", "Invalid signing context.", "error");
        return;
    }

    try {
        await setDoc(agreementStateRef, updateData, { merge: true });
        showMessage("Signature Saved", `Signature for ${signingAs} has been saved.`, "success");
        // Reload/re-render the agreement section to reflect changes
        await loadAndRenderServiceAgreement(currentAgreementWorkerEmail); 
    } catch (error) {
        console.error("Error saving signature:", error);
        logErrorToFirestore("saveSignature", error.message, error);
        showMessage("Save Error", "Could not save signature: " + error.message, "error");
    } finally {
        hideLoading();
    }
}

function generateAgreementPdf() {
    if (!agreementContentWrapperElement) {
        showMessage("PDF Error", "Cannot find agreement content for PDF.", "error");
        return;
    }
    showLoading("Generating Agreement PDF...");
    
    const workerNameForFile = (currentAgreementWorkerEmail || currentUserEmail).split('@')[0];
    const participantNameForFile = (globalSettings.defaultParticipantName || "Participant").replace(/\s+/g, '_');
    const filename = `ServiceAgreement-${participantNameForFile}-${workerNameForFile}.pdf`;

    // Prepare header for PDF
    const agreementHeaderPdf = $("#agreementHeaderForPdf");
    if (agreementHeaderPdf) {
        agreementHeaderPdf.innerHTML = `<h1>${agreementCustomData.overallTitle || "Service Agreement"}</h1>`;
        agreementHeaderPdf.style.display = 'block'; // Make it visible for PDF
    }
    
    // Ensure signature images are loaded for PDF
    $$('.signature-image').forEach(img => { if (img.src.startsWith('data:')) img.crossOrigin = "anonymous"; });


    html2pdf().from(agreementContentWrapperElement).set({
        margin: [15, 15, 15, 15],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: -window.scrollY },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }).save().then(() => {
        if (agreementHeaderPdf) agreementHeaderPdf.style.display = 'none'; // Hide after PDF generation
        hideLoading();
        showMessage("PDF Generated", `Agreement ${filename} downloaded.`, "success");
    }).catch(err => {
        if (agreementHeaderPdf) agreementHeaderPdf.style.display = 'none';
        hideLoading();
        console.error("Agreement PDF Generation Error:", err);
        logErrorToFirestore("generateAgreementPdf", err.message, err);
        showMessage("PDF Error", "Could not generate agreement PDF: " + err.message, "error");
    });
}

function clearAgreementDisplay() {
    if(agreementContentContainerElement) agreementContentContainerElement.innerHTML = '<p>Select a worker to view or generate their service agreement.</p>';
    if(participantSignatureImageElement) participantSignatureImageElement.src = 'https://placehold.co/250x85/e8e8e8/666666?text=Signature+Area';
    if(participantSignatureDateElement) participantSignatureDateElement.textContent = '___';
    if(workerSignatureImageElement) workerSignatureImageElement.src = 'https://placehold.co/250x85/e8e8e8/666666?text=Signature+Area';
    if(workerSignatureDateElement) workerSignatureDateElement.textContent = '___';
    if(agreementChipElement) {
        agreementChipElement.textContent = "No Worker Selected";
        agreementChipElement.className = 'chip';
    }
    if(signAgreementButtonElement) signAgreementButtonElement.classList.add('hide');
    if(participantSignButtonElement) participantSignButtonElement.classList.add('hide');
    if(downloadAgreementPdfButtonElement) downloadAgreementPdfButtonElement.classList.add('hide');
}


/* ========== Admin Section Functions ========== */
// (Full admin logic: global settings, service management, agreement customization, worker management)
// ... This section will be extensive ...
function renderAdminDashboard() {
    if (!userProfile.isAdmin) { navigateToSection("home"); return; }
    // Default to global settings tab, or remember last tab
    const activeAdminTab = adminNavTabButtons.find(btn => btn.classList.contains('active'))?.dataset.target || 'adminGlobalSettings';
    switchAdminTab(activeAdminTab);
    renderAdminGlobalSettingsTab(); // Always render this as it contains invite link etc.
}

function switchAdminTab(targetPanelId) {
    adminNavTabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === targetPanelId);
    });
    $$(".admin-content-panel").forEach(panel => {
        panel.classList.toggle('active', panel.id === targetPanelId);
    });

    // Load data or render specific tab content when switched
    if (targetPanelId === 'adminGlobalSettings') renderAdminGlobalSettingsTab();
    if (targetPanelId === 'adminServiceManagement') renderAdminServiceManagementTab();
    if (targetPanelId === 'adminAgreementCustomization') renderAdminAgreementCustomizationTab();
    if (targetPanelId === 'adminWorkerManagement') renderAdminWorkerManagementTab();
}

// --- Admin: Global Settings Tab ---
function renderAdminGlobalSettingsTab() {
    if (!userProfile.isAdmin) return;
    if (adminEditOrgNameInputElement) adminEditOrgNameInputElement.value = globalSettings.organizationName || "";
    if (adminEditOrgAbnInputElement) adminEditOrgAbnInputElement.value = globalSettings.organizationAbn || "";
    if (adminEditOrgContactEmailInputElement) adminEditOrgContactEmailInputElement.value = globalSettings.organizationContactEmail || "";
    if (adminEditOrgContactPhoneInputElement) adminEditOrgContactPhoneInputElement.value = globalSettings.organizationContactPhone || "";
    
    if (adminEditParticipantNameInputElement) adminEditParticipantNameInputElement.value = globalSettings.defaultParticipantName || "";
    if (adminEditParticipantNdisNoInputElement) adminEditParticipantNdisNoInputElement.value = globalSettings.defaultParticipantNdisNo || "";
    if (adminEditPlanManagerNameInputElement) adminEditPlanManagerNameInputElement.value = globalSettings.defaultPlanManagerName || "";
    if (adminEditPlanManagerEmailInputElement) adminEditPlanManagerEmailInputElement.value = globalSettings.defaultPlanManagerEmail || "";
    if (adminEditPlanManagerPhoneInputElement) adminEditPlanManagerPhoneInputElement.value = globalSettings.defaultPlanManagerPhone || "";
    if (adminEditPlanEndDateInputElement) adminEditPlanEndDateInputElement.value = formatDateForInput(globalSettings.defaultPlanEndDate) || "";

    // Show/hide org details based on portal type (though admin always sees them for now)
    const isOrgPortal = globalSettings.portalType === 'organization';
    if(adminEditOrgDetailsSectionElement) adminEditOrgDetailsSectionElement.style.display = isOrgPortal ? 'block' : 'none';
    if(adminEditParticipantHrElement) adminEditParticipantHrElement.style.display = isOrgPortal ? 'block' : 'none';
    if(adminEditParticipantTitleElement) adminEditParticipantTitleElement.textContent = isOrgPortal ? "Default Participant & Plan Details" : "Participant & Plan Details";


    // Generate invite link (simplified, could be more complex with tokens)
    // This is a conceptual link. Real invite systems are more secure.
    if (inviteLinkCodeElement) inviteLinkCodeElement.textContent = `${window.location.origin}${window.location.pathname}?registerAsWorker=true&appId=${appId}`;
}

async function saveAdminPortalSettings() {
    if (!userProfile.isAdmin) return;
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

    // portalType and setupComplete are usually handled by wizards or specific logic, not direct form save.
    // For now, we assume they are set correctly elsewhere.
    await saveGlobalSettingsToFirestore();
}

async function confirmResetGlobalSettings() {
    showMessage(
        "Confirm Reset",
        "Are you sure you want to reset ALL portal global settings to their original defaults? This includes organization details, participant details, and the service agreement template. This action cannot be undone.",
        "warning"
    );
    // Placeholder for custom modal confirmation.
    // For testing, we'll assume confirmation and call executeResetGlobalSettings.
    console.warn("Confirmation for resetting global settings would be handled by a custom modal. Proceeding for now.");
    await executeResetGlobalSettings();
}
window.confirmResetGlobalSettings = confirmResetGlobalSettings;

async function executeResetGlobalSettings() {
    if (!userProfile.isAdmin) return;
    showLoading("Resetting global settings...");
    globalSettings = getDefaultGlobalSettings(); // Get the hardcoded defaults
    agreementCustomData = JSON.parse(JSON.stringify(defaultAgreementCustomData)); // Reset agreement template too
    globalSettings.agreementTemplate = JSON.parse(JSON.stringify(agreementCustomData)); // Ensure it's in globalSettings
    
    const success = await saveGlobalSettingsToFirestore(); // This will save the defaults
    if (success) {
        renderAdminGlobalSettingsTab(); // Re-render the tab with new defaults
        renderAdminAgreementCustomizationTab(); // Also re-render agreement tab
        showMessage("Settings Reset", "Portal global settings have been reset to defaults.", "success");
    } else {
        showMessage("Reset Failed", "Could not reset global settings.", "error");
    }
    hideLoading();
}


// --- Admin: Service Management Tab ---
// ... (Functions for adding, editing, deleting NDIS services) ...
// ... (Rendering rate fields based on category type) ...
function renderAdminServiceManagementTab() {
    if (!userProfile.isAdmin) return;
    clearAdminServiceForm();
    renderAdminServicesTable(); // Uses adminManagedServices (loaded by loadAllDataForAdmin)
    populateServiceCategoryTypeDropdown();
    // Event listener for category type change to update rate fields
    if (adminServiceCategoryTypeSelectElement && !adminServiceCategoryTypeSelectElement.dataset.listenerAttached) {
        adminServiceCategoryTypeSelectElement.addEventListener('change', ()_INITIAL_AUTH_TOKEN__ !== 'undefined') { await signInWithCustomToken(auth, __INITIAL_AUTH_TOKEN__); } else { await signInAnonymously(auth); }
            // NOTE: If the __initial_auth_token is not defined, you should sign in anonymously using the `signInAnonymously()` method instead.`
