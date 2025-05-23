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
const shiftRequestsContainerElement = $("#shiftRequestsContainer"), shiftRequestsTableBodyElement = $("#rqTbl tbody");
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
const adminEditOrgDetailsSectionElement = $("#adminEditOrgDetailsSection"), adminEditParticipantHrElement = $("#adminEditParticipantHr"), adminEditParticipantTitleElement = $("#adminEditParticipantTitle"); 
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
const adminWizardOrgFieldsDivElement = $("#adminWizOrgFields"), adminWizardUserFieldsDivElement = $("#adminWizUserFields"); 
const adminWizardStep2TitleElement = $("#adminWizStep2Title"); 
const adminWizardOrgNameInputElement = $("#adminWizOrgName"), adminWizardOrgAbnInputElement = $("#adminWizOrgAbn"), adminWizardOrgContactEmailInputElement = $("#adminWizOrgContactEmail"), adminWizardOrgContactPhoneInputElement = $("#adminWizOrgContactPhone");
const adminWizardUserNameInputElement = $("#adminWizUserName"), adminWizardPrevButton2Element = $("#adminWizPrevBtn2"), adminWizardNextButton2Element = $("#adminWizNextBtn2");
const adminWizardStep3TitleElement = $("#adminWizStep3Title"); 
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
let agreementCustomData = {}; 
let defaultAgreementCustomData = { 
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
const RATE_CATEGORIES = ["weekday", "evening", "night", "saturday", "sunday", "public"];
const SERVICE_CATEGORY_TYPES = { CORE_STANDARD: 'core_standard', CORE_HIGH_INTENSITY: 'core_high_intensity', CAPACITY_THERAPY_STD: 'capacity_therapy_std', CAPACITY_SPECIALIST: 'capacity_specialist', TRAVEL_KM: 'travel_km', OTHER_FLAT_RATE: 'other_flat_rate' };
let sigCanvas, sigCtx, sigPen = false, sigPaths = [];
let currentAgreementWorkerEmail = null; 
let signingAs = 'worker';
let isFirebaseInitialized = false, initialAuthComplete = false;
let selectedWorkerUIDForAuth = null; 
let currentAdminServiceEditingId = null;
let currentTimePickerStep = 'ampm', selectedMinute = null, selectedHour12 = null, selectedAmPm = null, activeTimeInput = null, timePickerCallback = null;
let currentAdminWizardStep = 1, currentUserWizardStep = 1;
let wizardFileUploads = null; 
let allUsersCache = {}; 

/* ========== Error Logging ========== */
async function logErrorToFirestore(location, errorMsg, errorDetails = {}) {
    if (!fsDb || !appId || appId === 'ndis-portal-app-local') { console.error("Firestore not init/local dev, no log:", location, errorMsg, errorDetails); return; }
    try {
        await fsAddDoc(collection(fsDb, `artifacts/${appId}/public/logs/errors`), {
            location: String(location), errorMessage: String(errorMsg),
            errorStack: errorDetails instanceof Error ? errorDetails.stack : JSON.stringify(errorDetails),
            user: currentUserEmail || currentUserId || "unknown", timestamp: serverTimestamp(),
            appVersion: "1.1.3", userAgent: navigator.userAgent, url: window.location.href
        });
        console.info("Error logged:", location);
    } catch (logError) { console.error("FATAL: Could not log error:", logError, "Original:", location, errorMsg); }
}

/* ========== UI Helpers ========== */
function showLoading(message = "Loading...") { if (loadingOverlayElement) { loadingOverlayElement.querySelector('p').textContent = message; loadingOverlayElement.style.display = "flex"; } }
function hideLoading() { if (loadingOverlayElement) loadingOverlayElement.style.display = "none"; }
function showAuthStatusMessage(message, isError = true) { if (authStatusMessageElement) { authStatusMessageElement.textContent = message; authStatusMessageElement.style.color = isError ? 'var(--danger)' : 'var(--ok)'; authStatusMessageElement.style.display = message ? 'block' : 'none'; } }

function showMessage(title, text, type = 'info', okButtonConfig = null) {
    const iconClass = type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
    if (messageModalTitleElement) messageModalTitleElement.innerHTML = `<i class="fas ${iconClass}"></i> ${title}`;
    if (messageModalTextElement) messageModalTextElement.innerHTML = text;

    const currentOkButton = $("#closeMessageModalBtn"); // Get the current button
    if (currentOkButton) {
        // Clone and replace the button to remove all previous listeners safely
        const newOkButton = currentOkButton.cloneNode(true);
        currentOkButton.parentNode.replaceChild(newOkButton, currentOkButton);
        
        // Work with the new button
        const freshOkButton = $("#closeMessageModalBtn"); 

        if (okButtonConfig && typeof okButtonConfig.action === 'function') {
            freshOkButton.textContent = okButtonConfig.text || 'OK';
            freshOkButton.onclick = async () => { // Make it async to await the action
                if (okButtonConfig.action) {
                    await okButtonConfig.action(); 
                }
                closeModal('messageModal');
            };
        } else {
            freshOkButton.textContent = 'OK';
            freshOkButton.onclick = () => {
                closeModal('messageModal');
            };
        }
    }
    if (messageModalElement) messageModalElement.style.display = "flex";
}

function openModal(modalId) { const modal = $(`#${modalId}`); if (modal) modal.style.display = 'flex'; }
function closeModal(modalId) { const modal = $(`#${modalId}`); if (modal) modal.style.display = 'none'; }

/* ========== Utilities ========== */
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase()); }
function formatDateForDisplay(d) { if (!d) return ""; try { const date = d.toDate ? d.toDate() : new Date(d); return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return "Invalid Date"; } }
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
    if (!userProfile.isAdmin && globalSettings.portalType === 'organization' && userProfile.approved !== true) {
        showMessage(
            "Approval Required", 
            "Your account is awaiting approval from an administrator. Please log out and try again later once approved.", 
            "warning",
            { text: 'Logout', action: portalSignOut }
        );
        return true; 
    }
    if (userProfile.isAdmin) { 
        await loadAllDataForAdmin(); 
        enterPortal(true); 
        if (!globalSettings.adminSetupComplete && !globalSettings.setupComplete) {
             console.log("[AuthListener] Admin needs portal setup wizard.");
             openAdminSetupWizard();
        }
    } else { 
        await loadAllDataForUser(); 
        enterPortal(false); 
        if (!userProfile.profileSetupComplete) {
            console.log("[AuthListener] Regular user needs profile setup wizard.");
            openUserSetupWizard();
        }
    }
    return false; 
}

async function handleNewAdminProfile() {
    console.log("[Auth] New admin login (admin@portal.com).");
    userProfile = { isAdmin: true, name: "Administrator", email: currentUserEmail, uid: currentUserId, approved: true, createdAt: serverTimestamp(), profileSetupComplete: true, nextInvoiceNumber: 1001 };
    await setDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), userProfile);
    await loadAllDataForAdmin(); 
    enterPortal(true); 
    if (!globalSettings.adminSetupComplete && !globalSettings.setupComplete) { 
        console.log("[AuthListener] New admin needs portal setup wizard.");
        openAdminSetupWizard();
    }
    return false;
}

async function handleNewRegularUserProfile() {
    console.log("[Auth] New regular user profile creation.");
    const isOrg = globalSettings.portalType === 'organization';
    userProfile = { name: currentUserEmail.split('@')[0], email: currentUserEmail, uid: currentUserId, isAdmin: false, approved: !isOrg, profileSetupComplete: false, nextInvoiceNumber: 1001, createdAt: serverTimestamp() };
    await setDoc(doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details"), userProfile);
    if (isOrg && userProfile.approved !== true) { 
        showMessage(
            "Registration Complete - Approval Required", 
            "Your account has been created and is awaiting administrator approval. Please log out and try again later.", 
            "info",
            { text: 'Logout', action: portalSignOut }
        );
        return true; 
    }
    await loadAllDataForUser();
    enterPortal(false);
    if (!userProfile.profileSetupComplete) {
        console.log("[AuthListener] New regular user needs profile setup wizard.");
        openUserSetupWizard();
    }
    return false;
}

/* ========== Data Loading & Saving ========== */
async function loadUserProfileFromFirestore(uid) {
    try { const snap = await getDoc(doc(fsDb, "artifacts", appId, "users", uid, "profile", "details")); return snap.exists() ? snap.data() : null; }
    catch (e) { console.error("Profile Load Error:", e); logErrorToFirestore("loadUserProfile", e.message, e); return null; }
}

function getDefaultGlobalSettings() {
    return { portalTitle: "NDIS Support Portal", organizationName: "Your Organization", organizationAbn: "", organizationContactEmail: "", organizationContactPhone: "", defaultParticipantName: "Participant", defaultParticipantNdisNo: "", defaultPlanManagerName: "", defaultPlanManagerEmail: "", defaultPlanManagerPhone: "", defaultPlanEndDate: formatDateForInput(new Date(new Date().setFullYear(new Date().getFullYear() + 1))), setupComplete: false, adminSetupComplete: false, portalType: "organization", agreementTemplate: JSON.parse(JSON.stringify(defaultAgreementCustomData)) };
}

async function loadGlobalSettingsFromFirestore() {
    // Corrected path: artifacts/{appId}/public/data/portal_config/main
    const settingsDocRef = doc(fsDb, "artifacts", appId, "public", "data", "portal_config", "main");
    try { 
        const snap = await getDoc(settingsDocRef);
        if (snap.exists()) { 
            globalSettings = { ...getDefaultGlobalSettings(), ...snap.data() }; 
            console.log("[FirestoreLoad] Global settings loaded:", globalSettings);
        } else { 
            globalSettings = getDefaultGlobalSettings(); 
            console.log("[FirestoreLoad] No global settings doc, using defaults & saving.");
            await saveGlobalSettingsToFirestore(); // Save defaults for the first time
        }
    } catch (e) { 
        console.error("Settings Load Error:", e); 
        logErrorToFirestore("loadGlobalSettings", e.message, e); 
        globalSettings = getDefaultGlobalSettings(); 
    }
    agreementCustomData = globalSettings.agreementTemplate ? JSON.parse(JSON.stringify(globalSettings.agreementTemplate)) : JSON.parse(JSON.stringify(defaultAgreementCustomData));
    updatePortalTitle();
}

async function saveGlobalSettingsToFirestore() {
    if (!fsDb || !userProfile.isAdmin) { console.warn("Not admin or DB error, cannot save global settings."); return false; }
    globalSettings.agreementTemplate = JSON.parse(JSON.stringify(agreementCustomData));
    // Corrected path: artifacts/{appId}/public/data/portal_config/main
    const settingsDocRef = doc(fsDb, "artifacts", appId, "public", "data", "portal_config", "main");
    try { 
        await setDoc(settingsDocRef, globalSettings, { merge: true }); 
        console.log("Global settings saved."); 
        return true; 
    }
    catch (e) { console.error("Settings Save Error:", e); logErrorToFirestore("saveGlobalSettings", e.message, e); return false; }
}

async function loadAdminServicesFromFirestore() {
    adminManagedServices = [];
    if (!fsDb) return;
    // Path: artifacts/{appId}/public/services (collection)
    const servicesCollectionRef = collection(fsDb, "artifacts", appId, "public", "services");
    try { 
        const querySnapshot = await getDocs(servicesCollectionRef);
        querySnapshot.forEach(d => adminManagedServices.push({ id: d.id, ...d.data() }));
        console.log("Admin services loaded:", adminManagedServices.length);
    } catch (e) { console.error("Services Load Error:", e); logErrorToFirestore("loadAdminServices", e.message, e); }
    renderAdminServicesTable(); populateServiceTypeDropdowns();
}

async function loadAllUsersForAdmin() {
    allUsersCache = {};
    if (!userProfile.isAdmin || !fsDb) return;
    try {
        // Path: artifacts/{appId}/users (collection of user UIDs)
        const usersCollectionRef = collection(fsDb, "artifacts", appId, "users");
        const usersSnapshot = await getDocs(usersCollectionRef);
        const profilePromises = usersSnapshot.docs.map(userDoc => {
            const uid = userDoc.id;
            // Path: artifacts/{appId}/users/{uid}/profile/details (document)
            const profileRef = doc(fsDb, "artifacts", appId, "users", uid, "profile", "details");
            return getDoc(profileRef).then(profileSnap => ({uid, profileSnap}));
        });
        const results = await Promise.all(profilePromises);
        results.forEach(({uid, profileSnap}) => {
            if (profileSnap.exists()) {
                const profile = profileSnap.data();
                profile.uid = uid; 
                if (profile.email) allUsersCache[profile.email] = profile;
                allUsersCache[uid] = profile; 
            }
        });
        console.log("All users cached:", Object.keys(allUsersCache).length);
    } catch (error) {
        console.error("Error loading all users:", error);
        logErrorToFirestore("loadAllUsersForAdmin", error.message, error);
    }
}

async function loadAllDataForUser() { showLoading("Loading your data..."); await loadUserInvoiceDraft(); await loadUserShiftRequests(); hideLoading(); }
async function loadAllDataForAdmin() { showLoading("Loading admin data..."); await loadAllUsersForAdmin(); await loadAdminServicesFromFirestore(); await loadPendingApprovalWorkers(); await loadApprovedWorkersForAuthManagement(); renderAdminAgreementCustomizationTab(); hideLoading(); }

/* ========== Portal Entry & Navigation ========== */
function enterPortal(isAdmin) {
    console.log(`Entering portal. Admin: ${isAdmin}`);
    portalAppElement.style.display = "flex"; authScreenElement.style.display = "none";
    updateNavigation(isAdmin); updateProfileDisplay();
    if (isAdmin) { navigateToSection("admin"); renderAdminDashboard(); }
    else { navigateToSection("home"); renderUserHomePage(); if (userProfile.nextInvoiceNumber === undefined) openModal('setInitialInvoiceModal'); }
    updatePortalTitle();
}

function updateNavigation(isAdmin) {
    const linksToShow = ["#home", "#profile", "#invoice", "#agreement"];
    if (isAdmin) { linksToShow.push("#admin"); if(adminTabElement) adminTabElement.classList.remove('hide'); }
    else { if(adminTabElement) adminTabElement.classList.add('hide'); }
    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => a.classList.toggle('hide', !linksToShow.includes(a.hash)));
}
function updatePortalTitle() { const title = globalSettings.portalTitle || "NDIS Support Portal"; document.title = title; if (portalTitleDisplayElement) portalTitleDisplayElement.innerHTML = `<i class="fas fa-cogs"></i> ${title}`; }

function navigateToSection(sectionId) {
    $$("main section.card").forEach(s => s.classList.remove("active"));
    const target = $(`#${sectionId}`); if (target) target.classList.add("active");
    $$("nav a").forEach(a => a.classList.remove("active"));
    $$(`nav a[href="#${sectionId}"]`).forEach(a => a.classList.add("active"));
    if($("main")) $("main").scrollTop = 0;
    if (sectionId === "profile") renderProfileSection();
    if (sectionId === "invoice") renderInvoiceSection();
    if (sectionId === "agreement") renderAgreementSection();
    if (sectionId === "admin" && userProfile.isAdmin) renderAdminDashboard(); else if (sectionId === "admin" && !userProfile.isAdmin) navigateToSection("home"); 
    if (sectionId === "home") renderUserHomePage();
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
function renderProfileSection() { if (!userProfile || !currentUserId) { navigateToSection("home"); return; } updateProfileDisplay(); }
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
async function saveProfileDetails(updates) {
    if (!currentUserId || !fsDb) return false;
    showLoading("Saving profile...");
    try {
        await updateDoc(doc(fsDb, "artifacts", appId, "users", currentUserId, "profile", "details"), { ...updates, updatedAt: serverTimestamp() });
        userProfile = { ...userProfile, ...updates };
        updateProfileDisplay();
        showMessage("Profile Updated", "Your details saved.", "success");
        return true;
    } catch (e) { console.error("Profile Save Error:", e); logErrorToFirestore("saveProfileDetails", e.message, e); showMessage("Save Error", e.message, "error"); return false; }
    finally { hideLoading(); }
}
async function uploadProfileDocuments(filesToUploadParam = null) {
    const files = filesToUploadParam || profileFileUploadElement?.files;
    if (!files || files.length === 0) { showMessage("No Files", "Select files to upload.", "warning"); return; }
    if (!currentUserId || !fbStorage || !fsDb) { showMessage("Upload Error", "Auth/Storage unavailable.", "error"); return; }
    
    showLoading(`Uploading ${files.length} file(s)...`);
    const uploadedFileObjects = [];
    try {
        for (const file of Array.from(files)) { 
            const uniqueName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const storagePath = `artifacts/${appId}/users/${currentUserId}/profileDocuments/${uniqueName}`;
            const fileRef = ref(fbStorage, storagePath);
            const snapshot = await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            uploadedFileObjects.push({ name: file.name, url: downloadURL, storagePath, uploadedAt: serverTimestamp() });
        }
        await updateDoc(doc(fsDb, "artifacts", appId, "users", currentUserId, "profile", "details"), { files: arrayUnion(...uploadedFileObjects), updatedAt: serverTimestamp() });
        userProfile.files = [...(userProfile.files || []), ...uploadedFileObjects];
        renderProfileFilesList(); 
        if(profileFileUploadElement) profileFileUploadElement.value = ""; 
        showMessage("Upload Successful", `${uploadedFileObjects.length} file(s) uploaded.`, "success");
    } catch (e) { console.error("Upload Error:", e); logErrorToFirestore("uploadProfileDocs", e.message, e); showMessage("Upload Failed", e.message, "error"); }
    finally { hideLoading(); }
}
window.confirmDeleteProfileDocument = (name, path) => { 
    showMessage(
        "Confirm Delete", 
        `Delete "${name}"? This cannot be undone.`, 
        "warning",
        { 
            text: "Confirm Delete", 
            action: async () => { await executeDeleteProfileDocument(name, path); }
        }
    ); 
};
window.executeDeleteProfileDocument = async (fileName, storagePath) => {
    if (!currentUserId || !fbStorage || !fsDb) { showMessage("Delete Error", "Services unavailable.", "error"); return; }
    showLoading(`Deleting ${fileName}...`);
    try {
        await deleteObject(ref(fbStorage, storagePath));
        const updatedFiles = (userProfile.files || []).filter(f => f.storagePath !== storagePath);
        await updateDoc(doc(fsDb, "artifacts", appId, "users", currentUserId, "profile", "details"), { files: updatedFiles, updatedAt: serverTimestamp() });
        userProfile.files = updatedFiles;
        renderProfileFilesList();
        showMessage("File Deleted", `"${fileName}" deleted.`, "success");
    } catch (e) { console.error("Delete Error:", e); logErrorToFirestore("deleteProfileDoc", e.message, e); showMessage("Delete Failed", e.message, "error"); }
    finally { hideLoading(); }
};

/* ========== Shift Request & Log Functions ========== */
async function saveShiftRequest() {
    if (!currentUserId || !fsDb) { showMessage("Error", "Cannot save request.", "error"); return; }
    const requestData = {
        userId: currentUserId, userEmail: currentUserEmail,
        date: requestDateInputElement.value, startTime: requestStartTimeInputElement.dataset.value24,
        endTime: requestEndTimeInputElement.dataset.value24, reason: requestReasonTextareaElement.value.trim(),
        status: "pending", requestedAt: serverTimestamp()
    };
    if (!requestData.date || !requestData.startTime || !requestData.endTime) { showMessage("Missing Info", "Date, start, and end times required.", "warning"); return; }
    showLoading("Submitting request...");
    try {
        // Path: artifacts/{appId}/public/data/shift_requests/{auto_id}
        await fsAddDoc(collection(fsDb, "artifacts", appId, "public", "data", "shift_requests"), requestData);
        showMessage("Request Submitted", "Shift request sent.", "success");
        closeModal('rqModal'); requestDateInputElement.value = ""; requestStartTimeInputElement.value = ""; requestEndTimeInputElement.value = ""; requestReasonTextareaElement.value = "";
        loadUserShiftRequests();
    } catch (e) { console.error("Shift Request Error:", e); logErrorToFirestore("saveShiftRequest", e.message, e); showMessage("Error", e.message, "error"); }
    finally { hideLoading(); }
}
async function loadUserShiftRequests() {
    if (!currentUserId || !fsDb || !shiftRequestsTableBodyElement) return;
    shiftRequestsTableBodyElement.innerHTML = '<tr><td colspan="5">Loading requests...</td></tr>';
    try {
        // Path: artifacts/{appId}/public/data/shift_requests
        const q = query(collection(fsDb, "artifacts", appId, "public", "data", "shift_requests"), where("userId", "==", currentUserId)); 
        const snapshot = await getDocs(q);
        shiftRequestsTableBodyElement.innerHTML = ''; 
        if (snapshot.empty) { shiftRequestsTableBodyElement.innerHTML = '<tr><td colspan="5">No shift requests found.</td></tr>'; if(shiftRequestsContainerElement) shiftRequestsContainerElement.classList.add('hide'); return; }
        if(shiftRequestsContainerElement) shiftRequestsContainerElement.classList.remove('hide');
        snapshot.docs.sort((a,b) => (b.data().requestedAt?.toDate() || 0) - (a.data().requestedAt?.toDate() || 0)).forEach(doc => { 
            const req = doc.data();
            const row = shiftRequestsTableBodyElement.insertRow();
            row.innerHTML = `<td>${formatDateForDisplay(req.date)}</td><td>${formatTime12Hour(req.startTime)}</td><td>${formatTime12Hour(req.endTime)}</td><td>${req.reason || '-'}</td><td><span class="chip ${req.status === 'approved' ? 'green' : req.status === 'denied' ? 'red' : 'yellow'}">${req.status}</span></td>`;
        });
    } catch (e) { console.error("Error loading shift requests:", e); logErrorToFirestore("loadUserShiftRequests", e.message, e); shiftRequestsTableBodyElement.innerHTML = '<tr><td colspan="5">Error loading requests.</td></tr>'; }
}
function saveShiftToInvoice() {
    const date = logShiftDateInputElement.value; const supportTypeSelect = logShiftSupportTypeSelectElement; const serviceCode = supportTypeSelect.value;
    const service = adminManagedServices.find(s => s.code === serviceCode);
    if (!service) { showMessage("Error", "Invalid support type.", "error"); return; }
    const startTime = logShiftStartTimeInputElement.dataset.value24; const endTime = logShiftEndTimeInputElement.dataset.value24;
    const claimTravel = logShiftClaimTravelToggleElement.checked; let travelKm = 0;
    if (claimTravel) { const startKm = parseFloat(logShiftStartKmInputElement.value); const endKm = parseFloat(logShiftEndKmInputElement.value); if (!isNaN(startKm) && !isNaN(endKm) && endKm > startKm) { travelKm = parseFloat((endKm - startKm).toFixed(1)); } else if (endKm <= startKm && endKm !== 0) { showMessage("Travel Error", "End odometer must be greater.", "warning"); return; } }
    if (!date || !serviceCode || !startTime || !endTime) { showMessage("Missing Info", "Date, type, start/end times required.", "warning"); return; }
    const rateType = determineRateType(date, startTime); const hours = calculateHours(startTime, endTime);
    let ratePerUnit = service.rates ? (service.rates[rateType] || service.rates.flatRate || 0) : 0;
    const newItem = { id: generateUniqueId(), date, code: serviceCode, description: service.description, startTime, endTime, rateType, ratePerUnit, hoursOrKm: service.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM ? travelKm : hours, travelKmInput: travelKm, claimTravel: service.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM && claimTravel && service.associatedTravelCode ? true : false, isTravelService: service.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM, totalAmount: 0 };
    newItem.totalAmount = newItem.hoursOrKm * newItem.ratePerUnit;
    if (newItem.claimTravel && !newItem.isTravelService && service.associatedTravelCode) { const travelService = adminManagedServices.find(s => s.code === service.associatedTravelCode); if (travelService?.rates?.perKm) { newItem.totalAmount += travelKm * travelService.rates.perKm; } }
    currentInvoiceData.items.push(newItem);
    if ($("#invoice").classList.contains("active")) { addInvoiceRowToTable(newItem, currentInvoiceData.items.length - 1); } else { updateInvoiceTotals(); }
    showMessage("Shift Added", "Shift added to invoice draft.", "success"); closeModal('logShiftModal');
    logShiftDateInputElement.value = formatDateForInput(new Date()); logShiftSupportTypeSelectElement.selectedIndex = 0; logShiftStartTimeInputElement.value = ""; logShiftStartTimeInputElement.dataset.value24 = ""; logShiftEndTimeInputElement.value = ""; logShiftEndTimeInputElement.dataset.value24 = ""; logShiftClaimTravelToggleElement.checked = false; logShiftKmFieldsContainerElement.classList.add('hide'); logShiftStartKmInputElement.value = ""; logShiftEndKmInputElement.value = ""; logShiftCalculatedKmElement.textContent = "0.0 Km";
}

/* ========== Invoice Functions (Placeholders - to be fully implemented) ========== */
function renderInvoiceSection() { if (!userProfile || !currentUserId) { navigateToSection("home"); return; } if (userProfile.nextInvoiceNumber === undefined) { openModal('setInitialInvoiceModal'); } else { loadUserInvoiceDraft(); } populateInvoiceHeader(); renderInvoiceTable(); updateInvoiceTotals(); if(invoiceWeekLabelElement) invoiceWeekLabelElement.textContent = getWeekNumber(new Date(invoiceDateInputElement.value || Date.now())); }
function populateInvoiceHeader() { if(providerNameInputElement) providerNameInputElement.value = userProfile.name || ""; if(providerAbnInputElement) providerAbnInputElement.value = userProfile.abn || ""; if(gstFlagInputElement) gstFlagInputElement.value = userProfile.gstRegistered ? "Yes" : "No"; if(invoiceNumberInputElement) invoiceNumberInputElement.value = currentInvoiceData.invoiceNumber || userProfile.nextInvoiceNumber || "INV-001"; if(invoiceDateInputElement) invoiceDateInputElement.value = currentInvoiceData.invoiceDate || formatDateForInput(new Date()); }
function renderInvoiceTable() { if (!invoiceTableBodyElement) return; invoiceTableBodyElement.innerHTML = ''; currentInvoiceData.items.forEach((item, index) => addInvoiceRowToTable(item, index)); updateInvoiceTotals(); }
function addInvoiceRowToTable(itemData = {}, index = -1) { /* ... (Implementation from previous version, ensure print spans are updated in updateInvoiceItemFromRow) ... */ }
function addInvRowUserAction() { /* ... (Implementation from previous version) ... */ }
function updateInvoiceItemFromRow(rowElement, itemIndex) { /* ... (Implementation from previous version, ensure print spans are updated) ... */ }
window.deleteInvoiceRow = (button) => { /* ... (Implementation from previous version) ... */ };
function updateInvoiceTotals() { /* ... (Implementation from previous version) ... */ }
async function saveInvoiceDraft() { /* ... (Implementation from previous version) ... */ }
async function loadUserInvoiceDraft() { /* ... (Implementation from previous version) ... */ }
async function saveInitialInvoiceNumber() { /* ... (Implementation from previous version) ... */ }
function generateInvoicePdf() { /* ... (Implementation from previous version) ... */ }

/* ========== Agreement Functions (Placeholders) ========== */
function renderAgreementSection() { if (!userProfile || !currentUserId) { navigateToSection("home"); return; } if (userProfile.isAdmin) { if(adminAgreementWorkerSelectorElement) adminAgreementWorkerSelectorElement.classList.remove('hide'); populateAdminWorkerSelectorForAgreement(); clearAgreementDisplay(); } else { if(adminAgreementWorkerSelectorElement) adminAgreementWorkerSelectorElement.classList.add('hide'); currentAgreementWorkerEmail = currentUserEmail; loadAndRenderServiceAgreement(); } }
function populateAdminWorkerSelectorForAgreement() { if (!adminSelectWorkerForAgreementElement || !userProfile.isAdmin) return; adminSelectWorkerForAgreementElement.innerHTML = '<option value="">-- Select a Worker --</option>'; Object.values(allUsersCache).forEach(workerProfile => { if (workerProfile && !workerProfile.isAdmin && workerProfile.email) { const option = document.createElement('option'); option.value = workerProfile.email; option.textContent = `${workerProfile.name || 'N/A'} (${workerProfile.email})`; adminSelectWorkerForAgreementElement.appendChild(option); } }); }
async function loadAndRenderServiceAgreement(forWorkerEmail = null) { /* ... (Full implementation needed) ... */ }
function renderAgreementClauses(worker, settings, state) { /* ... (Full implementation needed) ... */ }
function updateAgreementChip(state) { /* ... (Full implementation needed) ... */ }
function openSignatureModal(who) { /* ... (Full implementation needed) ... */ }
function initializeSignaturePad() { /* ... (Full implementation needed) ... */ }
function clearSignaturePad() { /* ... (Full implementation needed) ... */ }
function sigStart(e) { /* ... (Full implementation needed) ... */ }
function sigDraw(e) { /* ... (Full implementation needed) ... */ }
function sigEnd(e) { /* ... (Full implementation needed) ... */ }
function getSigPenPosition(e) { /* ... (Full implementation needed) ... */ }
async function saveSignature() { /* ... (Full implementation needed) ... */ }
function generateAgreementPdf() { /* ... (Full implementation needed) ... */ }
function clearAgreementDisplay() { /* ... (Full implementation needed) ... */ }

/* ========== Admin Functions (Placeholders) ========== */
function renderAdminDashboard() { if (!userProfile.isAdmin) { navigateToSection("home"); return; } switchAdminTab(adminNavTabButtons.find(btn => btn.classList.contains('active'))?.dataset.target || 'adminGlobalSettings'); renderAdminGlobalSettingsTab(); }
function switchAdminTab(targetId) { adminNavTabButtons.forEach(b => b.classList.toggle('active', b.dataset.target === targetId)); adminContentPanels.forEach(p => p.classList.toggle('active', p.id === targetId)); if (targetId === 'adminGlobalSettings') renderAdminGlobalSettingsTab(); if (targetId === 'adminServiceManagement') renderAdminServiceManagementTab(); if (targetId === 'adminAgreementCustomization') renderAdminAgreementCustomizationTab(); if (targetId === 'adminWorkerManagement') renderAdminWorkerManagementTab(); }
function renderAdminGlobalSettingsTab() { /* ... (Full implementation needed) ... */ }
async function saveAdminPortalSettings() { /* ... (Full implementation needed) ... */ }
window.confirmResetGlobalSettings = () => { /* ... (Full implementation needed, with proper modal confirmation) ... */ };
async function executeResetGlobalSettings() { /* ... (Full implementation needed) ... */ }
function renderAdminServiceManagementTab() { /* ... (Full implementation needed) ... */ }
function populateServiceCategoryTypeDropdown() { /* ... (Full implementation needed) ... */ }
function renderAdminServiceRateFields() { /* ... (Full implementation needed) ... */ }
function clearAdminServiceForm() { /* ... (Full implementation needed) ... */ }
function renderAdminServicesTable() { /* ... (Full implementation needed) ... */ }
window.editAdminService = (id) => { /* ... (Full implementation needed) ... */ };
window.deleteAdminService = (id) => { /* ... (Full implementation needed, with proper modal confirmation) ... */ };
async function _confirmDeleteServiceFirestore(id) { /* ... (Full implementation needed) ... */ }
async function saveAdminServiceToFirestore() { /* ... (Full implementation needed) ... */ }
function openTravelCodeSelectionModal() { /* ... (Full implementation needed) ... */ }
function renderAdminAgreementCustomizationTab() { /* ... (Full implementation needed) ... */ }
function renderAdminAgreementClausesEditor() { /* ... (Full implementation needed) ... */ }
function addAdminAgreementClauseEditor() { /* ... (Full implementation needed) ... */ }
function updateAdminAgreementPreview() { /* ... (Full implementation needed) ... */ }
async function saveAdminAgreementCustomizationsToFirestore() { /* ... (Full implementation needed) ... */ }
function renderAdminWorkerManagementTab() { if (!userProfile.isAdmin) return; loadPendingApprovalWorkers(); loadApprovedWorkersForAuthManagement(); }
async function loadPendingApprovalWorkers() { /* ... (Full implementation needed, uses allUsersCache) ... */ }
window.approveWorkerInFirestore = async (uid) => { /* ... (Full implementation needed, updates allUsersCache) ... */ };
window.denyWorkerInFirestore = async (uid) => { /* ... (Full implementation needed, updates allUsersCache) ... */ };
async function loadApprovedWorkersForAuthManagement() { /* ... (Full implementation needed, uses allUsersCache) ... */ }
window.selectWorkerForAuth = (uid, name) => { selectedWorkerUIDForAuth = uid; if(selectedWorkerNameForAuthElement) selectedWorkerNameForAuthElement.innerHTML = `<i class="fas fa-user-check"></i> Services for: ${name}`; if(servicesForWorkerContainerElement) servicesForWorkerContainerElement.classList.remove('hide'); if(servicesListCheckboxesElement) servicesListCheckboxesElement.innerHTML = ''; const workerProfile = allUsersCache[uid]; const authorizedCodes = workerProfile?.authorizedServiceCodes || []; adminManagedServices.forEach(service => { const li = document.createElement('li'); li.innerHTML = `<label class="chk"><input type="checkbox" value="${service.code}" ${authorizedCodes.includes(service.code) ? 'checked' : ''}> ${service.description} (${service.code})</label>`; servicesListCheckboxesElement.appendChild(li); }); };
async function saveWorkerAuthorizationsToFirestore() { if (!selectedWorkerUIDForAuth || !fsDb || !userProfile.isAdmin) { showMessage("Error", "No worker selected or DB error.", "error"); return; } const workerToUpdate = allUsersCache[selectedWorkerUIDForAuth]; if (!workerToUpdate) { showMessage("Error", "Worker profile not found in cache.", "error"); return; } const selectedServices = Array.from(servicesListCheckboxesElement.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value); showLoading("Saving authorizations..."); try { await updateDoc(doc(fsDb, "artifacts", appId, "users", selectedWorkerUIDForAuth, "profile", "details"), { authorizedServiceCodes: selectedServices, authUpdatedAt: serverTimestamp(), authUpdatedBy: currentUserId }); if (allUsersCache[selectedWorkerUIDForAuth]) allUsersCache[selectedWorkerUIDForAuth].authorizedServiceCodes = selectedServices; showMessage("Authorizations Saved", "Worker service authorizations updated.", "success"); } catch (e) { console.error("Auth Save Error:", e); logErrorToFirestore("saveWorkerAuths", e.message, e); showMessage("Save Error", e.message, "error"); } finally { hideLoading(); } }

/* ========== Modal & Wizard Functions ========== */
function openUserSetupWizard() { currentUserWizardStep = 1; wizardFileUploads = null; navigateWizard('user', 1); if(userSetupWizardModalElement) openModal('wiz'); populateUserWizardFromProfile(); }
function openAdminSetupWizard() { currentAdminWizardStep = 1; navigateWizard('admin', 1); if(adminSetupWizardModalElement) openModal('adminSetupWizard'); populateAdminWizardFromSettings(); }
function navigateWizard(type, step) { const steps = type === 'user' ? userWizardStepElements : adminWizardStepElements; const indicators = type === 'user' ? userWizardIndicatorElements : adminWizardIndicatorElements; steps.forEach((s, i) => s.classList.toggle('hide', i + 1 !== step)); indicators.forEach((ind, i) => { ind.classList.toggle('active', i + 1 === step); ind.classList.toggle('completed', i + 1 < step); }); if (type === 'user') currentUserWizardStep = step; else currentAdminWizardStep = step; if (type === 'admin' && step === 2) { updateAdminWizardStep2UI(); } }
function wizardNext(type) { if (type === 'user' && currentUserWizardStep < 4) navigateWizard('user', currentUserWizardStep + 1); else if (type === 'admin' && currentAdminWizardStep < 3) navigateWizard('admin', currentAdminWizardStep + 1); }
function wizardPrev(type) { if (type === 'user' && currentUserWizardStep > 1) navigateWizard('user', currentUserWizardStep - 1); else if (type === 'admin' && currentAdminWizardStep > 1) navigateWizard('admin', currentAdminWizardStep - 1); }
async function finishUserWizard() {
    const profileUpdates = { name: wizardNameInputElement.value.trim(), abn: wizardAbnInputElement.value.trim(), gstRegistered: wizardGstCheckboxElement.checked, bsb: wizardBsbInputElement.value.trim(), acc: wizardAccInputElement.value.trim(), profileSetupComplete: true };
    if (!profileUpdates.name || (globalSettings.portalType === 'organization' && (!profileUpdates.abn || !profileUpdates.bsb || !profileUpdates.acc))) { showMessage("Missing Info", "Please fill all required fields.", "warning"); return; }
    showLoading("Finalizing setup...");
    const success = await saveProfileDetails(profileUpdates);
    if (success) {
        if (wizardFileUploads && wizardFileUploads.length > 0) {
            await uploadProfileDocuments(wizardFileUploads); 
        }
        closeModal('wiz'); showMessage("Setup Complete", "Your profile is updated.", "success"); enterPortal(userProfile.isAdmin);
    }
    hideLoading();
}
async function finishAdminWizard() {
    globalSettings.portalType = $$("input[name='adminWizPortalType']:checked")[0].value;
    if (globalSettings.portalType === 'organization') { globalSettings.organizationName = adminWizardOrgNameInputElement.value.trim(); globalSettings.organizationAbn = adminWizardOrgAbnInputElement.value.trim(); globalSettings.organizationContactEmail = adminWizardOrgContactEmailInputElement.value.trim(); globalSettings.organizationContactPhone = adminWizardOrgContactPhoneInputElement.value.trim(); } 
    else { userProfile.name = adminWizardUserNameInputElement.value.trim() || userProfile.name; globalSettings.organizationName = userProfile.name; globalSettings.organizationAbn = ""; globalSettings.organizationContactEmail = ""; globalSettings.organizationContactPhone = ""; }
    globalSettings.defaultParticipantName = adminWizardParticipantNameInputElement.value.trim(); globalSettings.defaultParticipantNdisNo = adminWizardParticipantNdisNoInputElement.value.trim(); globalSettings.defaultPlanManagerName = adminWizardPlanManagerNameInputElement.value.trim(); globalSettings.defaultPlanManagerEmail = adminWizardPlanManagerEmailInputElement.value.trim(); globalSettings.defaultPlanManagerPhone = adminWizardPlanManagerPhoneInputElement.value.trim(); globalSettings.defaultPlanEndDate = adminWizardPlanEndDateInputElement.value;
    globalSettings.setupComplete = true; globalSettings.adminSetupComplete = true;
    showLoading("Finalizing portal setup...");
    const settingsSuccess = await saveGlobalSettingsToFirestore();
    let profileSuccess = true; if (globalSettings.portalType === 'participant') { profileSuccess = await saveProfileDetails({name: userProfile.name }); }
    if (settingsSuccess && profileSuccess) { closeModal('adminSetupWizard'); showMessage("Setup Complete", "Portal settings saved.", "success"); renderAdminGlobalSettingsTab(); enterPortal(true); } 
    else { showMessage("Save Error", "Could not save all settings.", "error"); }
    hideLoading();
}
function populateUserWizardFromProfile() { if (!userProfile) return; if(wizardNameInputElement) wizardNameInputElement.value = userProfile.name || ""; if(wizardAbnInputElement) wizardAbnInputElement.value = userProfile.abn || ""; if(wizardGstCheckboxElement) wizardGstCheckboxElement.checked = userProfile.gstRegistered || false; if(wizardBsbInputElement) wizardBsbInputElement.value = userProfile.bsb || ""; if(wizardAccInputElement) wizardAccInputElement.value = userProfile.acc || ""; if(wizardFilesListElement) wizardFilesListElement.innerHTML = ''; wizardFileUploads = null; if(wizardFilesInputElement) wizardFilesInputElement.value = ''; }
function populateAdminWizardFromSettings() { if (!globalSettings) return; $$("input[name='adminWizPortalType']").forEach(radio => radio.checked = (radio.value === globalSettings.portalType)); updateAdminWizardStep2UI(); if(adminWizardOrgNameInputElement) adminWizardOrgNameInputElement.value = globalSettings.organizationName || ""; if(adminWizardOrgAbnInputElement) adminWizardOrgAbnInputElement.value = globalSettings.organizationAbn || ""; if(adminWizardOrgContactEmailInputElement) adminWizardOrgContactEmailInputElement.value = globalSettings.organizationContactEmail || ""; if(adminWizardOrgContactPhoneInputElement) adminWizardOrgContactPhoneInputElement.value = globalSettings.organizationContactPhone || ""; if(adminWizardUserNameInputElement) adminWizardUserNameInputElement.value = userProfile.name || ""; if(adminWizardParticipantNameInputElement) adminWizardParticipantNameInputElement.value = globalSettings.defaultParticipantName || ""; if(adminWizardParticipantNdisNoInputElement) adminWizardParticipantNdisNoInputElement.value = globalSettings.defaultParticipantNdisNo || ""; if(adminWizardPlanManagerNameInputElement) adminWizardPlanManagerNameInputElement.value = globalSettings.defaultPlanManagerName || ""; if(adminWizardPlanManagerEmailInputElement) adminWizardPlanManagerEmailInputElement.value = globalSettings.defaultPlanManagerEmail || ""; if(adminWizardPlanManagerPhoneInputElement) adminWizardPlanManagerPhoneInputElement.value = globalSettings.defaultPlanManagerPhone || ""; if(adminWizardPlanEndDateInputElement) adminWizardPlanEndDateInputElement.value = formatDateForInput(globalSettings.defaultPlanEndDate) || ""; }
function updateAdminWizardStep2UI() { const portalType = $$("input[name='adminWizPortalType']:checked")[0]?.value; if(adminWizardOrgFieldsDivElement) adminWizardOrgFieldsDivElement.style.display = portalType === 'organization' ? 'block' : 'none'; if(adminWizardUserFieldsDivElement) adminWizardUserFieldsDivElement.style.display = portalType === 'participant' ? 'block' : 'none'; if(adminWizardStep2TitleElement) adminWizardStep2TitleElement.textContent = portalType === 'organization' ? "Step 2: Organization Details" : "Step 2: Your Details"; if(adminWizardStep3TitleElement) adminWizardStep3TitleElement.textContent = portalType === 'organization' ? "Step 3: Default Participant Details" : "Step 3: Participant Details"; }
function openCustomTimePicker(inputEl, cb) { activeTimeInput = inputEl; timePickerCallback = cb; currentTimePickerStep = 'ampm'; selectedAmPm = null; selectedHour12 = null; selectedMinute = null; renderTimePickerStep(); openModal('customTimePicker'); }
function renderTimePickerStep() { if(!customTimePickerElement) return; $$('#customTimePicker .time-picker-step').forEach(el => el.classList.add('hide')); timePickerBackButtonElement.classList.toggle('hide', currentTimePickerStep === 'ampm'); setTimeButtonElement.disabled = true; if (currentTimePickerStep === 'ampm') { $('#timePickerStepAmPm').classList.remove('hide'); if(currentTimePickerStepLabelElement) currentTimePickerStepLabelElement.textContent = "(Select AM/PM)"; timePickerAmPmButtonsContainerElement.innerHTML = ['AM', 'PM'].map(p => `<button data-value="${p}" class="btn-secondary ${selectedAmPm === p ? 'selected' : ''}">${p}</button>`).join(''); timePickerAmPmButtonsContainerElement.querySelectorAll('button').forEach(b => b.onclick = () => { selectedAmPm = b.dataset.value; currentTimePickerStep = 'hour'; renderTimePickerStep(); }); } else if (currentTimePickerStep === 'hour') { $('#timePickerStepHour').classList.remove('hide'); if(currentTimePickerStepLabelElement) currentTimePickerStepLabelElement.textContent = `(${selectedAmPm} - Select Hour)`; timePickerHoursContainerElement.innerHTML = Array.from({length: 12}, (_, i) => i + 1).map(h => `<button data-value="${h}" class="btn-secondary ${selectedHour12 === h ? 'selected' : ''}">${h}</button>`).join(''); timePickerHoursContainerElement.querySelectorAll('button').forEach(b => b.onclick = () => { selectedHour12 = parseInt(b.dataset.value); currentTimePickerStep = 'minute'; renderTimePickerStep(); }); } else if (currentTimePickerStep === 'minute') { $('#timePickerStepMinute').classList.remove('hide'); if(currentTimePickerStepLabelElement) currentTimePickerStepLabelElement.textContent = `(${selectedAmPm} ${selectedHour12} : Select Minute)`; timePickerMinutesContainerElement.innerHTML = ['00', '15', '30', '45'].map(m => `<button data-value="${m}" class="btn-secondary ${selectedMinute === parseInt(m) ? 'selected' : ''}">${m}</button>`).join(''); timePickerMinutesContainerElement.querySelectorAll('button').forEach(b => b.onclick = () => { selectedMinute = parseInt(b.dataset.value); setTimeButtonElement.disabled = false; renderTimePickerStep(); }); } }
function handleTimePickerBack() { if (currentTimePickerStep === 'minute') currentTimePickerStep = 'hour'; else if (currentTimePickerStep === 'hour') currentTimePickerStep = 'ampm'; renderTimePickerStep(); }
function handleSetTime() { if (selectedAmPm && selectedHour12 !== null && selectedMinute !== null) { let hour24 = selectedHour12; if (selectedAmPm === 'PM' && selectedHour12 !== 12) hour24 += 12; if (selectedAmPm === 'AM' && selectedHour12 === 12) hour24 = 0; const time24 = `${String(hour24).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`; if (timePickerCallback) timePickerCallback(time24); closeModal('customTimePicker'); } else { showMessage("Incomplete Time", "Select AM/PM, hour, and minute.", "warning"); } }
function renderUserHomePage() { if (!userProfile || !currentUserId) { if(homeUserDivElement) homeUserDivElement.classList.add('hide'); console.log("RenderUserHomePage: No user profile/ID."); return; } if (userNameDisplayElement) userNameDisplayElement.textContent = userProfile.name || "User"; if (homeUserDivElement) homeUserDivElement.classList.remove('hide'); if (userProfile.isAdmin) { if(requestShiftButtonElement) requestShiftButtonElement.classList.add('hide'); if(logTodayShiftButtonElement) logTodayShiftButtonElement.classList.add('hide'); if(shiftRequestsContainerElement) shiftRequestsContainerElement.classList.add('hide'); } else { if(requestShiftButtonElement) requestShiftButtonElement.classList.remove('hide'); if(logTodayShiftButtonElement) logTodayShiftButtonElement.classList.remove('hide'); loadUserShiftRequests(); } }
function populateServiceTypeDropdowns(targetSelectElement = null) { const selectsToUpdate = targetSelectElement ? [targetSelectElement] : [logShiftSupportTypeSelectElement]; selectsToUpdate.forEach(selectElement => { if (!selectElement) return; const currentValue = selectElement.value; selectElement.innerHTML = '<option value="">-- Select Support Type --</option>'; const servicesToList = adminManagedServices.filter(s => s.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM || selectElement === logShiftSupportTypeSelectElement); servicesToList.forEach(service => { const option = document.createElement('option'); option.value = service.code; option.textContent = `${service.description} (${service.code})`; selectElement.appendChild(option); }); if (currentValue) selectElement.value = currentValue; }); $$('#invTbl .item-description-select').forEach(select => { const currentValue = select.dataset.currentValue || select.value; select.innerHTML = '<option value="">-- Select Service --</option>'; adminManagedServices.forEach(service => { const option = document.createElement('option'); option.value = service.code; option.textContent = `${service.description} (${service.code})`; select.appendChild(option); }); if (currentValue) { select.value = currentValue; } }); }


/* ========== Event Listeners Setup ========== */
function setupEventListeners() {
    loginButtonElement?.addEventListener('click', modalLogin);
    registerButtonElement?.addEventListener('click', modalRegister);
    logoutButtonElement?.addEventListener('click', portalSignOut);
    authPasswordInputElement?.addEventListener('keypress', e => { if (e.key === 'Enter') modalLogin(); });
    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => a.addEventListener('click', e => { e.preventDefault(); navigateToSection(a.hash.substring(1)); }));
    editProfileButtonElement?.addEventListener('click', () => openUserSetupWizard());
    uploadProfileDocumentsButtonElement?.addEventListener('click', () => uploadProfileDocuments()); 
    addInvoiceRowButtonElement?.addEventListener('click', addInvRowUserAction);
    saveDraftButtonElement?.addEventListener('click', saveInvoiceDraft);
    generateInvoicePdfButtonElement?.addEventListener('click', generateInvoicePdf);
    saveInitialInvoiceNumberButtonElement?.addEventListener('click', saveInitialInvoiceNumber);
    invoiceDateInputElement?.addEventListener('change', () => { if(invoiceWeekLabelElement) invoiceWeekLabelElement.textContent = getWeekNumber(new Date(invoiceDateInputElement.value || Date.now())); });
    signAgreementButtonElement?.addEventListener('click', () => openSignatureModal('worker'));
    participantSignButtonElement?.addEventListener('click', () => openSignatureModal('participant'));
    downloadAgreementPdfButtonElement?.addEventListener('click', generateAgreementPdf);
    saveSignatureButtonElement?.addEventListener('click', saveSignature);
    closeSignatureModalButtonElement?.addEventListener('click', () => closeModal('sigModal'));
    loadServiceAgreementForSelectedWorkerButtonElement?.addEventListener('click', () => { currentAgreementWorkerEmail = adminSelectWorkerForAgreementElement.value; if (currentAgreementWorkerEmail) loadAndRenderServiceAgreement(currentAgreementWorkerEmail); else clearAgreementDisplay(); });
    adminNavTabButtons.forEach(btn => btn.addEventListener('click', () => switchAdminTab(btn.dataset.target)));
    saveAdminPortalSettingsButtonElement?.addEventListener('click', saveAdminPortalSettings);
    resetGlobalSettingsToDefaultsButtonElement?.addEventListener('click', window.confirmResetGlobalSettings);
    copyInviteLinkButtonElement?.addEventListener('click', () => { if(inviteLinkCodeElement?.textContent) { navigator.clipboard.writeText(inviteLinkCodeElement.textContent); showMessage("Copied!", "Invite link copied.", "success"); }});
    saveAdminServiceButtonElement?.addEventListener('click', saveAdminServiceToFirestore);
    clearAdminServiceFormButtonElement?.addEventListener('click', clearAdminServiceForm);
    selectTravelCodeButtonElement?.addEventListener('click', openTravelCodeSelectionModal);
    adminServiceCategoryTypeSelectElement?.addEventListener('change', renderAdminServiceRateFields);
    adminAddAgreementClauseButtonElement?.addEventListener('click', addAdminAgreementClauseEditor);
    saveAdminAgreementCustomizationsButtonElement?.addEventListener('click', saveAdminAgreementCustomizationsToFirestore);
    saveWorkerAuthorizationsButtonElement?.addEventListener('click', saveWorkerAuthorizationsToFirestore);
    closeRequestModalButtonElement?.addEventListener('click', () => closeModal('rqModal'));
    saveRequestButtonElement?.addEventListener('click', saveShiftRequest);
    closeLogShiftModalButtonElement?.addEventListener('click', () => closeModal('logShiftModal'));
    saveShiftToInvoiceButtonElement?.addEventListener('click', saveShiftToInvoice);
    // Default closeMessageModalButtonElement listener (set once)
    closeMessageModalButtonElement?.addEventListener('click', () => {
        // This is the default action if no specific action was set by showMessage
        closeModal('messageModal');
    });
    wizardNextButton1Element?.addEventListener('click', () => wizardNext('user')); wizardNextButton2Element?.addEventListener('click', () => wizardNext('user')); wizardNextButton3Element?.addEventListener('click', () => { wizardFileUploads = wizardFilesInputElement.files; wizardNext('user'); });
    wizardPrevButton2Element?.addEventListener('click', () => wizardPrev('user')); wizardPrevButton3Element?.addEventListener('click', () => wizardPrev('user')); wizardPrevButton4Element?.addEventListener('click', () => wizardPrev('user'));
    wizardFinishButtonElement?.addEventListener('click', finishUserWizard);
    adminWizardNextButton1Element?.addEventListener('click', () => wizardNext('admin')); adminWizardNextButton2Element?.addEventListener('click', () => wizardNext('admin'));
    adminWizardPrevButton2Element?.addEventListener('click', () => wizardPrev('admin')); adminWizardPrevButton3Element?.addEventListener('click', () => wizardPrev('admin'));
    adminWizardFinishButtonElement?.addEventListener('click', finishAdminWizard);
    $$("input[name='adminWizPortalType']").forEach(radio => radio.addEventListener('change', updateAdminWizardStep2UI));
    cancelTimeButtonElement?.addEventListener('click', () => closeModal('customTimePicker'));
    setTimeButtonElement?.addEventListener('click', handleSetTime);
    timePickerBackButtonElement?.addEventListener('click', handleTimePickerBack);
    confirmTravelCodeSelectionButtonElement?.addEventListener('click', () => { closeModal('travelCodeSelectionModal'); });
    closeTravelCodeSelectionModalButtonElement?.addEventListener('click', () => closeModal('travelCodeSelectionModal'));
    requestShiftButtonElement?.addEventListener('click', () => { requestDateInputElement.value = formatDateForInput(new Date()); openModal('rqModal'); });
    logTodayShiftButtonElement?.addEventListener('click', () => { populateServiceTypeDropdowns(logShiftSupportTypeSelectElement); logShiftDateInputElement.value = formatDateForInput(new Date()); openModal('logShiftModal'); });
    logShiftClaimTravelToggleElement?.addEventListener('change', (e) => logShiftKmFieldsContainerElement.classList.toggle('hide', !e.target.checked));
    [logShiftStartKmInputElement, logShiftEndKmInputElement].forEach(el => el?.addEventListener('input', () => {
        const start = parseFloat(logShiftStartKmInputElement.value); const end = parseFloat(logShiftEndKmInputElement.value);
        if (!isNaN(start) && !isNaN(end) && end > start) logShiftCalculatedKmElement.textContent = `${(end - start).toFixed(1)} Km`; else logShiftCalculatedKmElement.textContent = "0.0 Km";
    }));
    window.addEventListener('hashchange', () => { const hash = window.location.hash || '#home'; navigateToSection(hash.substring(1)); });
}

/* ========== App Initialization ========== */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed");
    showLoading("Initializing Portal...");
    await initializeFirebaseApp();
    setupEventListeners(); // Call this once
    const initialHash = window.location.hash || '#home';
    navigateToSection(initialHash.substring(1));
    hideLoading(); 
});
