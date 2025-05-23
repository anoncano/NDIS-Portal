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
    arrayRemove,
    addDoc as fsAddDoc // Renamed to avoid conflict with local addDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Firebase Storage imports
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";


/* ========== DOM helpers ========== */
const $ = q => document.querySelector(q);
const $$ = q => [...document.querySelectorAll(q)];

/* ========== Firebase Global Variables & Config ========== */
let fbApp;
let fbAuth;
let fsDb;
let fbStorage; // Firebase Storage instance
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
let pendingApprovalAccounts = []; // For admin to see users awaiting approval
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
    logErrorToFirestore("agreementCustomDataInit", e.message, e);
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

/* ========== Error Logging to Firestore ========== */
async function logErrorToFirestore(location, errorMsg, errorDetails = {}) {
    if (!fsDb || !appId) {
        console.error("Firestore not initialized or appId missing, cannot log error to Firestore:", location, errorMsg);
        return;
    }
    try {
        const errorLogRef = collection(fsDb, `artifacts/${appId}/public/logs/errors`);
        await fsAddDoc(errorLogRef, {
            location: location,
            errorMessage: errorMsg,
            errorStack: errorDetails.stack || (errorDetails instanceof Error ? errorDetails.toString() : JSON.stringify(errorDetails)),
            user: currentUserEmail || currentUserId || "unknown/anonymous",
            timestamp: serverTimestamp(),
            appVersion: "1.0.3", // Consider making this dynamic or part of a build process
            userAgent: navigator.userAgent
        });
        console.log("Error logged to Firestore:", location);
    } catch (logError) {
        console.error("FATAL: Could not log error to Firestore:", logError);
        console.error("Original error was at:", location, "Message:", errorMsg);
    }
}


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
    if (mtxt) mtxt.innerHTML = text; // Use innerHTML to allow for HTML content in messages
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
        // Optionally clear auth status message when generic message modal is closed
        // showAuthStatusMessage(""); 
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
    // Handle YYYY-MM-DD string, Firestore timestamp, JS Date object, or epoch number
    if (typeof dateInput === 'string' && dateInput.match(/^\d{4}-\d{2}-\d{2}/)) { date = new Date(dateInput); }
    else if (typeof dateInput === 'number') { date = new Date(dateInput); } // Assume epoch milliseconds
    else if (dateInput && dateInput.toDate) { date = dateInput.toDate(); } // Firestore Timestamp
    else if (dateInput instanceof Date) { date = dateInput; } // Already a Date object
    else { console.warn("Unrecognized date format for display:", dateInput); return "Invalid Date"; }
    
    // Adjust for user's local timezone if the input was a YYYY-MM-DD string (interpreted as UTC)
    // This ensures that '2023-10-26' is displayed as '26 Oct 23' regardless of user's timezone.
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);

    return `${correctedDate.getDate()} ${correctedDate.toLocaleString('en-AU', { month: 'short' })} ${correctedDate.getFullYear().toString().slice(-2)}`;
}
function timeToMinutes(timeStr) { if (!timeStr) return 0; const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; }

function calculateHours(startTime24, endTime24) {
    if (!startTime24 || !endTime24) return 0;
    const startMinutes = timeToMinutes(startTime24);
    const endMinutes = timeToMinutes(endTime24);
    if (endMinutes < startMinutes) return 0; // Or handle overnight shifts if necessary
    return (endMinutes - startMinutes) / 60;
}

function determineRateType(dateStr, startTime24) {
    if (!dateStr || !startTime24) return "weekday"; // Default if inputs are missing
    const date = new Date(dateStr);
    const day = date.getDay(); // 0 (Sunday) to 6 (Saturday)
    const hr = parseInt(startTime24.split(':')[0],10);

    // This logic might need adjustment based on specific NDIS rules for public holidays, etc.
    // For now, a simplified version:
    if (day === 0) return "sunday"; // Sunday
    if (day === 6) return "saturday"; // Saturday
    if (hr >= 20) return "evening"; // Evening (e.g., 8 PM onwards)
    if (hr < 6) return "night";   // Night (e.g., before 6 AM)
    return "weekday"; // Default
}
function formatTime12Hour(t24){if(!t24)return"";const [h,m]=t24.split(':'),hr=parseInt(h,10);if(isNaN(hr)||isNaN(parseInt(m,10)))return"";const ap=hr>=12?'PM':'AM';let hr12=hr%12;hr12=hr12?hr12:12;return`${String(hr12).padStart(2,'0')}:${m} ${ap}`;}

/* ========== Input Validation Helpers ========== */
function isValidABN(abn) {
    if (!abn || typeof abn !== 'string') return false;
    const cleanedAbn = abn.replace(/\s/g, ''); // Remove all spaces
    if (!/^\d{11}$/.test(cleanedAbn)) return false; // Must be 11 digits

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
    const cleanedBsb = bsb.replace(/[\s-]/g, ''); // Remove spaces and hyphens
    return /^\d{6}$/.test(cleanedBsb); // Must be 6 digits
}

function isValidAccountNumber(acc) {
    if (!acc || typeof acc !== 'string') return false;
    const cleanedAcc = acc.replace(/\s/g, ''); // Remove spaces
    return /^\d{6,10}$/.test(cleanedAcc); // Typically 6-10 digits, adjust if needed
}


/* ========== Firebase Initialization and Auth State ========== */
async function initializeFirebase() {
    console.log("Attempting to initialize Firebase with config:", JSON.stringify(window.firebaseConfigForApp, null, 2));

    const currentFirebaseConfig = window.firebaseConfigForApp; // Use the config passed from the window
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
        fbStorage = getStorage(fbApp); // Initialize Firebase Storage

        if (!fbAuth || !fsDb || !fbStorage) {
            console.error("Failed to get Firebase Auth, Firestore or Storage instance.");
            if (authScreenElement) authScreenElement.style.display = "flex";
            if (portalAppElement) portalAppElement.style.display = "none";
            showAuthStatusMessage("System Error: Core services failed to initialize.");
            hideLoading();
            isFirebaseInitialized = false;
            return;
        }

        isFirebaseInitialized = true;
        console.log("Firebase initialized with Cloud Firestore and Storage.");
        await setupAuthListener(); // Set up the auth state listener
    } catch (error) {
        console.error("Firebase initialization error:", error);
        logErrorToFirestore("initializeFirebase", error.message, error);
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
            showAuthStatusMessage("", false); // Clear previous auth messages
            try {
                if (user) {
                    currentUserId = user.uid;
                    currentUserEmail = user.email; // Can be null for anonymous or phone auth
                    if($("#userIdDisplay")) $("#userIdDisplay").textContent = currentUserId + (user.email ? ` (${user.email})` : " (Anonymous)");
                    if($("#logoutBtn")) $("#logoutBtn").classList.remove('hide');

                    if (authScreenElement) authScreenElement.style.display = "none";
                    if (portalAppElement) portalAppElement.style.display = "flex";

                    // Load global settings first, as they might influence profile loading/creation
                    await loadGlobalSettingsFromFirestore();
                    const userProfileData = await loadUserProfileFromFirestore(currentUserId);

                    if (userProfileData) {
                        profile = userProfileData;
                        // Store in accounts cache by email if available, otherwise by UID
                        if (profile.email) accounts[profile.email] = { name: profile.name, profile: profile };
                        else accounts[currentUserId] = { name: profile.name, profile: profile };

                        // Worker Approval Check for Organization Portals
                        if (!profile.isAdmin && globalSettings.portalType === 'organization' && profile.approved !== true) {
                            showMessage("Approval Required", "Your account is awaiting approval from an administrator. You will be logged out.");
                            await fbSignOut(fbAuth); // This will re-trigger onAuthStateChanged with user = null
                            hideLoading();
                            return; // Exit early
                        }


                        if (profile.isAdmin) {
                            await loadAllDataForAdmin(); // Load all users, services etc.
                            if (!globalSettings.setupComplete) {
                                openAdminSetupWizard();
                            } else {
                                enterPortal(true); // Enter as admin
                            }
                        } else { // Regular user
                            await loadAllDataForUser(); // Load services, agreement customizations
                            // Check if user setup is needed for organization portal type
                            if (globalSettings.portalType === 'organization' && (!profile.abn || !profile.bsb || !profile.acc || !profile.profileSetupComplete)) {
                                openUserSetupWizard();
                            } else {
                                enterPortal(false); // Enter as user
                            }
                        }
                    } else if (currentUserEmail && currentUserEmail.toLowerCase() === "admin@portal.com" && !userProfileData) {
                        // First-time admin login, create admin profile
                        profile = { isAdmin: true, name: "Administrator", email: currentUserEmail, uid: currentUserId, approved: true, createdAt: serverTimestamp(), createdBy: "system" };
                        const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
                        await setDoc(userProfileDocRef, profile);
                        await loadAllDataForAdmin();
                        if (!globalSettings.setupComplete) {
                            openAdminSetupWizard();
                        } else {
                            enterPortal(true);
                        }
                    } else if (!userProfileData && currentUserEmail && currentUserEmail.toLowerCase() !== "admin@portal.com") {
                        // New user registration (not admin@portal.com)
                        const isOrgPortal = globalSettings.portalType === 'organization';
                        profile = {
                            name: currentUserEmail.split('@')[0], // Use email from the outer scope (user.email)
                            email: currentUserEmail,
                            uid: currentUserId,
                            isAdmin: false,
                            abn: "",
                            gstRegistered: false,
                            bsb: "",
                            acc: "",
                            files: [], // Initialize as empty array
                            authorizedServiceCodes: [], // Initialize as empty array
                            profileSetupComplete: false,
                            nextInvoiceNumber: 1001, // Default starting invoice number
                            approved: !isOrgPortal, // Auto-approve if not an organization portal
                            createdAt: serverTimestamp(),
                            createdBy: currentUserId
                        };
                        const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
                        await setDoc(userProfileDocRef, profile);
                        accounts[currentUserEmail] = { name: profile.name, profile: profile };

                        if (isOrgPortal && !profile.approved) {
                            showMessage("Approval Required", "Your account has been created and is awaiting administrator approval. You will be logged out.");
                            await fbSignOut(fbAuth);
                            hideLoading();
                            return;
                        }

                        await loadAllDataForUser();
                        if (globalSettings.portalType === 'organization' && !profile.profileSetupComplete) {
                             openUserSetupWizard();
                        } else {
                            enterPortal(false);
                        }
                    } else {
                        // User logged in (e.g. anonymous) but no profile, or unclear state
                        console.warn("User logged in, but profile data is missing or role is unclear.");
                        logErrorToFirestore("setupAuthListener", "User logged in, but profile data is missing or role is unclear.", {uid: currentUserId, email: currentUserEmail});
                        await loadAllDataForUser(); // Load basic data
                        enterPortal(false); // Default to non-admin portal view
                    }

                } else { // User is signed out
                    currentUserId = null; currentUserEmail = null; profile = {}; accounts = {};
                    if($("#userIdDisplay")) $("#userIdDisplay").textContent = "Not Logged In";
                    if($("#logoutBtn")) $("#logoutBtn").classList.add('hide');

                    if (authScreenElement) authScreenElement.style.display = "flex";
                    if (portalAppElement) portalAppElement.style.display = "none";

                    // Hide all nav links except home, and hide admin tab
                    $$("nav#side a.link, nav#bottom a.bLink").forEach(a => { if (a.hash !== "#home") a.classList.add('hide'); });
                    if($("#adminTab")) $("#adminTab").classList.add('hide');
                    if($("#homeUser")) $("#homeUser").classList.add("hide"); // Hide user-specific home content
                }
            } catch (error) {
                console.error("Error in onAuthStateChanged logic:", error);
                logErrorToFirestore("onAuthStateChanged", error.message, error);
                showAuthStatusMessage("Authentication State Error: " + error.message);
                currentUserId = null; currentUserEmail = null; profile = {}; accounts = {};
                if (authScreenElement) authScreenElement.style.display = "flex";
                if (portalAppElement) portalAppElement.style.display = "none";
            } finally {
                if (!initialAuthComplete) { initialAuthComplete = true; resolve(); }
                hideLoading();
            }
        });

        // Handle initial auth token if provided (e.g., from Canvas environment)
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            console.log("Attempting sign-in with custom token.");
            showLoading("Authenticating with token...");
            signInWithCustomToken(fbAuth, __initial_auth_token)
                .catch((error) => {
                    console.error("Custom token sign-in error:", error);
                    logErrorToFirestore("signInWithCustomToken", error.message, error);
                    showAuthStatusMessage("Token Sign-In Error: " + error.message);
                    // Still resolve promise to allow app to proceed to auth screen if token fails
                    if (!initialAuthComplete) { initialAuthComplete = true; resolve(); }
                    hideLoading();
                });
        } else if (fbAuth.currentUser) { // If already signed in (e.g. session persistence)
            // onAuthStateChanged will handle it, just resolve if not already done
            if (!initialAuthComplete) { initialAuthComplete = true; resolve(); }
        } else { // No token, no active session
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
        logErrorToFirestore("loadUserProfileFromFirestore", error.message, {userIdToLoad, error});
        showMessage("Data Error", "Could not load user profile.");
        return null;
    }
}

// Load data relevant for a standard user
async function loadAllDataForUser() {
    if (!isFirebaseInitialized) return;
    // Users need admin services (for invoices, agreements) and agreement customizations
    await Promise.all([ loadAdminServicesFromFirestore(), loadAgreementCustomizationsFromFirestore() ]);
}
// Load all data relevant for an admin
async function loadAllDataForAdmin() {
    if (!isFirebaseInitialized) return;
    // Admins need their services, agreement customizations, and all user accounts
    await Promise.all([ loadAdminServicesFromFirestore(), loadAgreementCustomizationsFromFirestore(), loadAllUserAccountsForAdminFromFirestore() ]);
}

async function getDefaultGlobalSettingsFirestore() {
    // Returns a default structure for global settings.
    return {
        setupComplete: false, portalType: "organization", organizationName: "NDIS Support Portal",
        organizationAbn: "", organizationContactEmail: "", organizationContactPhone: "", adminUserName: "",
        participantName: "Participant Name", participantNdisNo: "000 000 000",
        planManagerName: "Plan Manager Name", planManagerEmail: "manager@example.com", planManagerPhone: "0400 000 000",
        planEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], // Default to one year from now
        agreementStartDate: new Date().toISOString().split('T')[0], // Default to today
        rateMultipliers: { weekday: 1.00, evening: 1.10, night: 1.14, saturday: 1.41, sunday: 1.81, public: 2.22 }, // Example multipliers
        lastUpdated: serverTimestamp(),
        updatedBy: "system",
        createdAt: serverTimestamp(),
        createdBy: "system"
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
        logErrorToFirestore("loadGlobalSettingsFromFirestore", e.message, e);
        globalSettings = await getDefaultGlobalSettingsFirestore(); // Fallback to defaults on error
        showMessage("Data Error", "Could not load portal settings.");
    }
}
async function saveGlobalSettingsToFirestore() {
    if (!isFirebaseInitialized || !(profile && profile.isAdmin)) return; // Only admins can save global settings
    try {
        const settingsDocRef = doc(fsDb, `artifacts/${appId}/public/data/settings`, "global");
        const settingsToSave = {
            ...globalSettings,
            lastUpdated: serverTimestamp(),
            updatedBy: currentUserEmail || currentUserId || "admin_system"
        };
        if (!globalSettings.createdAt) { // If it's the first save
            settingsToSave.createdAt = serverTimestamp();
            settingsToSave.createdBy = currentUserEmail || currentUserId || "admin_system";
        }
        await setDoc(settingsDocRef, settingsToSave, { merge: true }); // Merge to avoid overwriting fields not managed here
    } catch (e) {
        console.error("Could not save global settings to Firestore:", e);
        logErrorToFirestore("saveGlobalSettingsToFirestore", e.message, e);
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
        // Ensure rates object exists for each service
        adminManagedServices.forEach(s => { if (!s.rates || typeof s.rates !== 'object') s.rates = {}; });
    } catch (e) {
        console.error("Error loading admin services from Firestore:", e);
        logErrorToFirestore("loadAdminServicesFromFirestore", e.message, e);
        adminManagedServices = []; // Clear on error
        showMessage("Data Error", "Could not load NDIS services.");
    }
}
async function saveAdminServiceToFirestore(servicePayload, serviceIdToUpdate = null) {
    if (!isFirebaseInitialized || !(profile && profile.isAdmin)) return false;
    try {
        const servicesCollectionRef = collection(fsDb, `artifacts/${appId}/public/data/services`);
        let serviceDocRef;
        let payloadWithAudit;

        if (serviceIdToUpdate) { // Editing an existing service
            serviceDocRef = doc(fsDb, `artifacts/${appId}/public/data/services`, serviceIdToUpdate);
            payloadWithAudit = {
                ...servicePayload,
                id: serviceDocRef.id, // Ensure ID is part of the payload
                lastUpdated: serverTimestamp(),
                updatedBy: currentUserEmail || currentUserId
            };
        } else { // Adding a new service
            // Check for duplicate service code before adding
            const q = query(servicesCollectionRef, where("code", "==", servicePayload.code));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                showMessage("Validation Error", `Service code '${servicePayload.code}' already exists.`);
                if ($("#adminServiceCode")) $("#adminServiceCode").focus();
                return false; // Prevent saving
            }
            serviceDocRef = doc(servicesCollectionRef); // Firestore generates a new ID
            payloadWithAudit = {
                ...servicePayload,
                id: serviceDocRef.id, // Store the generated ID
                createdAt: serverTimestamp(),
                createdBy: currentUserEmail || currentUserId,
                lastUpdated: serverTimestamp(),
                updatedBy: currentUserEmail || currentUserId
            };
        }

        await setDoc(serviceDocRef, payloadWithAudit, { merge: true }); // Use setDoc with merge for both add/edit

        // Update local cache
        const existingIndex = adminManagedServices.findIndex(s => s.id === serviceDocRef.id);
        if (existingIndex > -1) {
            adminManagedServices[existingIndex] = payloadWithAudit;
        } else {
            adminManagedServices.push(payloadWithAudit);
        }
        return true;
    } catch (e) {
        console.error("Error saving service to Firestore:", e);
        logErrorToFirestore("saveAdminServiceToFirestore", e.message, e);
        showMessage("Storage Error", "Could not save service.");
        return false;
    }
}
async function deleteAdminServiceFromFirestore(serviceId) {
    if (!isFirebaseInitialized || !(profile && profile.isAdmin)) return false;
    try {
        const serviceDocRef = doc(fsDb, `artifacts/${appId}/public/data/services`, serviceId);
        await deleteDoc(serviceDocRef);
        // Update local cache
        adminManagedServices = adminManagedServices.filter(s => s.id !== serviceId);
        return true;
    } catch (e) {
        console.error("Error deleting service from Firestore:", e);
        logErrorToFirestore("deleteAdminServiceFromFirestore", e.message, e);
        showMessage("Storage Error", "Could not delete service.");
        return false;
    }
}

async function loadAgreementCustomizationsFromFirestore() {
    if (!isFirebaseInitialized) { return; } // Don't proceed if Firebase isn't ready
    try {
        const agreementDocRef = doc(fsDb, `artifacts/${appId}/public/data/agreementTemplates`, "main");
        const docSnap = await getDoc(agreementDocRef);
        if (docSnap.exists()) {
            const loadedData = docSnap.data();
            if (!agreementCustomData) agreementCustomData = {}; // Initialize if null/undefined
            agreementCustomData.overallTitle = loadedData.overallTitle || "NDIS Service Agreement";
            // Only overwrite clauses if they exist in Firestore and are valid
            if (loadedData.clauses && Array.isArray(loadedData.clauses) && loadedData.clauses.length > 0) {
                agreementCustomData.clauses = loadedData.clauses;
            } else if (!agreementCustomData.clauses) { // If local clauses are also missing, set a default
                 agreementCustomData.clauses = [{ heading: "Default Clause", body: "Details to be confirmed."}];
            }
        }  else if (!agreementCustomData) { // If no doc in Firestore and no local data (e.g. first run)
             agreementCustomData = { // Set a default structure
                overallTitle: "NDIS Service Agreement (Default)",
                clauses: [{ heading: "Service Details", body: "To be agreed upon." }],
                createdAt: serverTimestamp(),
                createdBy: "system_init" // Mark as system initialized
            };
            await setDoc(agreementDocRef, agreementCustomData); // Save this default to Firestore
        }
        // If docSnap doesn't exist but agreementCustomData is already populated (e.g. from initial script values), keep local.
    } catch (e) {
        console.error("Error loading agreement customizations from Firestore:", e);
        logErrorToFirestore("loadAgreementCustomizationsFromFirestore", e.message, e);
        showMessage("Data Error", "Could not load agreement template.");
        // Fallback if agreementCustomData is still not set
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
    // Ensure agreementCustomData is an object
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
            if (heading || body) newClauses.push({ heading, body }); // Only add if there's content
        });
    }
    agreementCustomData.clauses = newClauses.length > 0 ? newClauses : (agreementCustomData.clauses || []); // Keep existing if new is empty
    const dataToSave = {
        ...agreementCustomData,
        lastUpdated: serverTimestamp(),
        updatedBy: currentUserEmail || currentUserId
    };
     if (!agreementCustomData.createdAt) { // If it's the first save of this structure
        dataToSave.createdAt = serverTimestamp();
        dataToSave.createdBy = currentUserEmail || currentUserId;
    }

    try {
        // Save to the 'main' template document
        const mainAgreementDocRef = doc(fsDb, `artifacts/${appId}/public/data/agreementTemplates`, "main");
        await setDoc(mainAgreementDocRef, dataToSave, {merge: true}); // Merge to preserve other fields if any

        // Save a versioned copy for history/auditing
        const versionsCollectionRef = collection(fsDb, `artifacts/${appId}/public/data/agreementTemplates/versions`);
        await fsAddDoc(versionsCollectionRef, { // fsAddDoc will generate a unique ID for each version
            ...dataToSave, // Spread the current data
            versionTimestamp: serverTimestamp() // Add a specific timestamp for this version
        });

        showMessage("Success","Agreement structure saved and versioned.");
        renderAdminAgreementPreview(); // Update the preview on the admin page
    } catch (e) {
        console.error("Error saving agreement customizations to Firestore:", e);
        logErrorToFirestore("saveAdminAgreementCustomizationsToFirestore", e.message, e);
        showMessage("Storage Error", "Could not save agreement structure.");
    }
}

// Auth Screen Functions
window.modalLogin = async function () {
  const emailInput = $("#authEmail");
  const passwordInput = $("#authPassword");
  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value.trim() : "";

  showAuthStatusMessage("", false); // Clear previous messages

  if (!email || !validateEmail(email) || !password || password.length < 6) {
      return showAuthStatusMessage("Valid email and a password of at least 6 characters are required.");
  }
  if (!isFirebaseInitialized || !fbAuth) {
      return showAuthStatusMessage("System Error: Authentication service not ready. Please refresh.");
  }

  try {
    showLoading("Signing in...");
    await signInWithEmailAndPassword(fbAuth, email, password);
    // onAuthStateChanged will handle UI changes and data loading
  } catch (err) {
      console.error("Login Failed:", err);
      logErrorToFirestore("modalLogin", err.message, err);
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

        showAuthStatusMessage("", false); // Clear previous messages

        if (!email || !validateEmail(email) || !password || password.length < 6) {
            return showAuthStatusMessage("Valid email and a password of at least 6 characters are required for registration.");
        }
        if (!isFirebaseInitialized || !fbAuth || !fsDb) {
            return showAuthStatusMessage("System Error: Registration service not ready. Please refresh.");
        }

        try {
            showLoading("Registering...");
            const userCredential = await createUserWithEmailAndPassword(fbAuth, email, password);
            if (userCredential && userCredential.user) {
                const newUserId = userCredential.user.uid;
                // Create a basic profile for the new user
                const isOrgPortal = globalSettings.portalType === 'organization';
                const initialProfileData = {
                    name: email.split('@')[0], // Default name from email prefix
                    email: email,
                    uid: newUserId,
                    isAdmin: false,
                    abn: "",
                    gstRegistered: false,
                    bsb: "",
                    acc: "",
                    files: [],
                    authorizedServiceCodes: [],
                    profileSetupComplete: false,
                    nextInvoiceNumber: 1001,
                    approved: !isOrgPortal, // Auto-approve if not an organization portal
                    createdAt: serverTimestamp(),
                    createdBy: newUserId
                };
                const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${newUserId}/profile`, "details");
                await setDoc(userProfileDocRef, initialProfileData);

                // onAuthStateChanged will typically handle the next steps (loading profile, redirecting)
                // but we can give immediate feedback.
                if (isOrgPortal && !initialProfileData.approved) {
                    showMessage("Registration Successful", "Your account has been created and is awaiting administrator approval. You will be logged out.");
                    // Optionally sign them out here if onAuthStateChanged doesn't handle it quickly enough for this message
                    // await fbSignOut(fbAuth); 
                } else {
                    showMessage("Registration Successful", "Your account has been created! You will be logged in shortly.");
                }
            }
        } catch (err) {
            console.error("Registration Failed:", err);
            logErrorToFirestore("modalRegister", err.message, err);
            showAuthStatusMessage(err.message || "Could not create account. Email might be in use or network issue.");
        } finally {
            hideLoading();
        }
    };


// Profile Page Functions
window.editProfile = function() {
    if (!currentUserId || !profile) {
        showMessage("Error", "User not logged in or profile not loaded.");
        return;
    }
    openUserSetupWizard(true); // Open wizard in editing mode
};

window.uploadProfileDocuments = async function() {
    if (!currentUserId || !fsDb || !fbStorage) {
        showMessage("Error", "System not ready for file uploads. Please try again later.");
        return;
    }
    const fileInput = $("#profileFileUpload");
    if (!fileInput || fileInput.files.length === 0) {
        showMessage("No Files", "Please select one or more files to upload.");
        return;
    }

    showLoading("Uploading documents...");
    const filesToUpload = Array.from(fileInput.files);
    const newFileEntries = [];
    const uploadPromises = [];

    for (const file of filesToUpload) {
        const uniqueFileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`; // Ensure unique name
        const storageRef = ref(fbStorage, `artifacts/${appId}/users/${currentUserId}/documents/${uniqueFileName}`);

        uploadPromises.push(
            uploadBytes(storageRef, file).then(async (snapshot) => {
                const downloadURL = await getDownloadURL(snapshot.ref);
                newFileEntries.push({
                    name: file.name, // Original file name
                    url: downloadURL,
                    storagePath: snapshot.ref.fullPath, // Store the full path for deletion
                    uploadedAt: serverTimestamp(),
                    size: file.size,
                    type: file.type
                });
                console.log(`Uploaded ${file.name}, URL: ${downloadURL}`);
            }).catch(error => {
                console.error(`Error uploading file ${file.name}:`, error);
                logErrorToFirestore("uploadProfileDocuments_uploadBytes", error.message, {fileName: file.name, error});
                showMessage("Upload Error", `Could not upload ${file.name}.`);
            })
        );
    }

    try {
        await Promise.all(uploadPromises); // Wait for all uploads to complete

        if (newFileEntries.length > 0) {
            const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
            // Atomically add new file entries to the 'files' array in Firestore
            await updateDoc(userProfileDocRef, {
                files: arrayUnion(...newFileEntries), // Use arrayUnion to add new files
                lastUpdated: serverTimestamp(),
                updatedBy: currentUserId
            });
            // Refresh local profile data
            const updatedProfileSnap = await getDoc(userProfileDocRef);
            if (updatedProfileSnap.exists()) {
                profile = updatedProfileSnap.data();
            }
            loadProfileData(); // Re-render the profile files list
            showMessage("Documents Uploaded", `${newFileEntries.length} file(s) uploaded successfully.`);
        } else if (filesToUpload.length > 0) {
             showMessage("Upload Issue", "Some files may not have uploaded successfully. Please check and try again.");
        }
    } catch (error) {
        console.error("Error updating profile with file metadata after uploads:", error);
        logErrorToFirestore("uploadProfileDocuments_updateProfile", error.message, error);
        showMessage("Error", "Could not update profile with file information: " + error.message);
    } finally {
        fileInput.value = ""; // Clear the file input
        hideLoading();
    }
};

// Invoice Page Functions
window.addInvRowUserAction = function() { // Renamed to avoid conflict if addInvoiceRow is used internally
    addInvoiceRow(); // Call the main function to add a row
    showMessage("Row Added", "A new row has been added to the invoice. Please fill in the details.");
};

window.saveDraft = async function() {
    if (!currentUserId || !fsDb) {
        showMessage("Error", "Cannot save draft. User not logged in or database not ready.");
        return;
    }
    showLoading("Saving invoice draft...");

    // Populate currentInvoiceData from the form
    currentInvoiceData.invoiceNumber = $("#invNo")?.value || "";
    currentInvoiceData.invoiceDate = $("#invDate")?.value || new Date().toISOString().split('T')[0];
    currentInvoiceData.providerName = $("#provName")?.value || ""; // This might be from profile or global settings
    currentInvoiceData.providerAbn = $("#provAbn")?.value || "";
    currentInvoiceData.gstRegistered = ($("#gstFlag")?.value.toLowerCase() === 'yes');

    currentInvoiceData.items = [];
    const rows = $$("#invTbl tbody tr");
    rows.forEach((row) => {
        const itemDateEl = row.querySelector(`input[id^="itemDate"]`);
        const itemDescEl = row.querySelector(`select[id^="itemDesc"]`); // This is a select
        const itemStartTimeEl = row.querySelector(`input[id^="itemStart"]`);
        const itemEndTimeEl = row.querySelector(`input[id^="itemEnd"]`);
        const itemTravelKmEl = row.querySelector(`input[id^="itemTravel"]`);
        const itemClaimTravelEl = row.querySelector(`input[id^="itemClaimTravel"]`);

        const serviceCode = itemDescEl ? itemDescEl.value : "";
        const service = adminManagedServices.find(s => s.code === serviceCode);

        currentInvoiceData.items.push({
            date: itemDateEl ? itemDateEl.value : "",
            serviceCode: serviceCode,
            description: service ? service.description : "N/A", // Store description for easier display later
            startTime: itemStartTimeEl ? itemStartTimeEl.dataset.value24 : "",
            endTime: itemEndTimeEl ? itemEndTimeEl.dataset.value24 : "",
            hoursOrKm: parseFloat(row.cells[8].textContent) || 0, // Assuming cell 8 is Hours/Km
            total: parseFloat(row.cells[10].textContent.replace('$', '')) || 0, // Assuming cell 10 is Total
            travelKmInput: itemTravelKmEl ? parseFloat(itemTravelKmEl.value) || 0 : 0,
            claimTravel: itemClaimTravelEl ? itemClaimTravelEl.checked : false,
            rateType: determineRateType(itemDateEl?.value, itemStartTimeEl?.dataset.value24) // Store determined rate type
        });
    });

    calculateInvoiceTotals(); // Recalculate totals before saving
    currentInvoiceData.subtotal = parseFloat($("#sub")?.textContent.replace('$', '')) || 0;
    currentInvoiceData.gst = parseFloat($("#gst")?.textContent.replace('$', '')) || 0;
    currentInvoiceData.grandTotal = parseFloat($("#grand")?.textContent.replace('$', '')) || 0;
    currentInvoiceData.lastUpdated = serverTimestamp();
    currentInvoiceData.updatedBy = currentUserId;


    try {
        // Save to a specific draft document, e.g., using the invoice number or 'current'
        const draftDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, `draft-${currentInvoiceData.invoiceNumber || 'current'}`);
        await setDoc(draftDocRef, currentInvoiceData, {merge: true}); // Merge to update or create

        // If this draft corresponds to the user's *next* invoice number, increment it in their profile
        if (profile.nextInvoiceNumber && !isNaN(parseInt(profile.nextInvoiceNumber)) && formatInvoiceNumber(profile.nextInvoiceNumber) === currentInvoiceData.invoiceNumber) {
            profile.nextInvoiceNumber = parseInt(profile.nextInvoiceNumber) + 1;
            const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
            await updateDoc(userProfileDocRef, { 
                nextInvoiceNumber: profile.nextInvoiceNumber,
                lastUpdated: serverTimestamp(),
                updatedBy: currentUserId
            });
            if ($("#invNo")) $("#invNo").value = formatInvoiceNumber(profile.nextInvoiceNumber); // Update UI for next invoice
        }

        showMessage("Draft Saved", `Invoice draft "${currentInvoiceData.invoiceNumber || 'current'}" has been saved.`);
    } catch (error) {
        console.error("Error saving invoice draft:", error);
        logErrorToFirestore("saveDraft", error.message, error);
        showMessage("Storage Error", "Could not save invoice draft: " + error.message);
    } finally {
        hideLoading();
    }
};

// Helper to sanitize strings for filenames
function sanitizeFilename(name) {
    if (!name || typeof name !== 'string') return 'unknown';
    return name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase(); // Replace invalid chars with underscore
}

window.generateInvoicePdf = function() {
    if (!currentUserId || !profile) {
        showMessage("Error", "Cannot generate PDF. User data not loaded.");
        return;
    }
    if (!currentInvoiceData || !currentInvoiceData.items || currentInvoiceData.items.length === 0) {
        showMessage("Empty Invoice", "Cannot generate PDF for an empty invoice. Please add services.");
        return;
    }

    // Ensure currentInvoiceData is up-to-date with form fields before PDF generation
    currentInvoiceData.invoiceNumber = $("#invNo")?.value || "N/A";
    currentInvoiceData.invoiceDate = $("#invDate")?.value || new Date().toISOString().split('T')[0];
    currentInvoiceData.providerName = profile.name || "N/A"; // From user's profile
    currentInvoiceData.providerAbn = profile.abn || "N/A";   // From user's profile
    currentInvoiceData.gstRegistered = profile.gstRegistered || false; // From user's profile

    currentInvoiceData.items = []; // Re-populate items from the table to ensure accuracy
    const rows = $$("#invTbl tbody tr");
    rows.forEach((row) => {
        const itemDateEl = row.querySelector(`input[id^="itemDate"]`);
        const itemDescEl = row.querySelector(`select[id^="itemDesc"]`);
        const itemStartTimeEl = row.querySelector(`input[id^="itemStart"]`);
        const itemEndTimeEl = row.querySelector(`input[id^="itemEnd"]`);
        const itemTravelKmEl = row.querySelector(`input[id^="itemTravel"]`); // For travel type services
        const itemClaimTravelEl = row.querySelector(`input[id^="itemClaimTravel"]`); // For claiming travel with other services

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
    calculateInvoiceTotals(); // Recalculate totals based on potentially updated items
    currentInvoiceData.subtotal = parseFloat($("#sub")?.textContent.replace('$', '')) || 0;
    currentInvoiceData.gst = parseFloat($("#gst")?.textContent.replace('$', '')) || 0;
    currentInvoiceData.grandTotal = parseFloat($("#grand")?.textContent.replace('$', '')) || 0;


    // HTML content for the PDF
    let pdfHtml = `
        <style>
            body { font-family: 'Inter', sans-serif; font-size: 10pt; }
            .pdf-invoice-container { padding: 15mm; } /* A4 padding */
            .pdf-header { text-align: center; margin-bottom: 15mm; }
            .pdf-header h1 { margin: 0 0 3mm 0; font-size: 20pt; color: #333; }
            .pdf-header p { margin: 2mm 0; font-size: 9pt; color: #555; }
            .pdf-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; margin-bottom: 10mm; font-size: 9pt;}
            .pdf-details-grid div { margin-bottom: 2mm; }
            .pdf-details-grid strong { font-weight: 600; }
            .pdf-table { width: 100%; border-collapse: collapse; margin-bottom: 10mm; font-size: 8pt; page-break-inside: auto; }
            .pdf-table th, .pdf-table td { border: 1px solid #bbb; padding: 4mm 5mm; text-align: left; word-break: break-word; }
            .pdf-table th { background-color: #e9ecef; font-weight: 600; }
            .pdf-table tr { page-break-inside: avoid !important; } /* Try to keep rows from splitting */
            .pdf-table td.number { text-align: right; }
            .pdf-totals { float: right; width: 60mm; margin-top: 10mm; font-size: 10pt; page-break-inside: avoid !important; }
            .pdf-totals div { display: flex; justify-content: space-between; margin-bottom: 3mm; }
            .pdf-totals strong { font-weight: 600; }
        </style>
        <div class="pdf-invoice-container">
            <div class="pdf-header">
                <h1>Tax Invoice</h1>
                <p>${currentInvoiceData.providerName ?? "Provider Name N/A"}</p>
                <p>ABN: ${currentInvoiceData.providerAbn ?? "ABN N/A"}</p>
                ${(currentInvoiceData.gstRegistered) ? '<p>GST Registered</p>' : ''}
            </div>

            <div class="pdf-details-grid">
                <div>
                    <strong>To:</strong> ${globalSettings.participantName ?? 'Participant N/A'}<br>
                    NDIS No: ${globalSettings.participantNdisNo ?? 'N/A'}<br>
                    ${globalSettings.planManagerName ? `Plan Manager: ${globalSettings.planManagerName}<br>` : ''}
                    ${globalSettings.planManagerEmail ? `Email: ${globalSettings.planManagerEmail}<br>` : ''}
                </div>
                <div>
                    <strong>Invoice #:</strong> ${currentInvoiceData.invoiceNumber || 'N/A'}<br>
                    <strong>Date Issued:</strong> ${formatDateForInvoiceDisplay(currentInvoiceData.invoiceDate) || 'N/A'}<br>
                    <strong>Support Worker:</strong> ${profile.name ?? 'N/A'}
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
        let rateTypeForPdf = item.rateType || determineRateType(item.date, item.startTime); // Use stored or re-determine

        if (service && service.rates) {
            if (service.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) {
                rateForPdf = service.rates.perKmRate || 0;
                rateTypeForPdf = "Travel"; // Override rate type display for travel
            } else if (service.categoryType === SERVICE_CATEGORY_TYPES.CORE_STANDARD || service.categoryType === SERVICE_CATEGORY_TYPES.CORE_HIGH_INTENSITY) {
                rateForPdf = service.rates[rateTypeForPdf] || service.rates.weekday || 0; // Fallback to weekday if specific rate type missing
            } else { // Other categories like Therapy, Specialist
                rateForPdf = service.rates.standardRate || 0;
            }
        }

        pdfHtml += `
                    <tr>
                        <td>${formatDateForInvoiceDisplay(item.date) ?? 'N/A'}</td>
                        <td>${item.serviceCode ?? 'N/A'}</td>
                        <td>${item.description ?? 'N/A'}</td>
                        <td>${formatTime12Hour(item.startTime) ?? 'N/A'}</td>
                        <td>${formatTime12Hour(item.endTime) ?? 'N/A'}</td>
                        <td>${rateTypeForPdf ?? 'N/A'}</td>
                        <td class="number">${rateForPdf.toFixed(2)}</td>
                        <td class="number">${(item.hoursOrKm ?? 0).toFixed(2)}</td>
                        <td class="number">${(item.total ?? 0).toFixed(2)}</td>
                    </tr>`;
    });

    pdfHtml += `
                </tbody>
            </table>

            <div class="pdf-totals">
                <div><span>Subtotal:</span> <strong>$${(currentInvoiceData.subtotal ?? 0).toFixed(2)}</strong></div>`;
    if (currentInvoiceData.gstRegistered) { // Only show GST if applicable
        pdfHtml += `<div><span>GST (10%):</span> <strong>$${(currentInvoiceData.gst ?? 0).toFixed(2)}</strong></div>`;
    }
    pdfHtml += `   <div><span>Total:</span> <strong>$${(currentInvoiceData.grandTotal ?? 0).toFixed(2)}</strong></div>
            </div>
        </div>`;

    // Create a temporary div to render the HTML for html2pdf
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px"; // Off-screen
    tempDiv.style.width = "210mm"; // A4 width, helps with layout
    tempDiv.innerHTML = pdfHtml;
    document.body.appendChild(tempDiv);

    // Sanitize names for the PDF filename
    const sanitizedProviderName = sanitizeFilename(currentInvoiceData.providerName);
    const sanitizedParticipantName = sanitizeFilename(globalSettings.participantName);
    const sanitizedInvoiceNumber = sanitizeFilename(currentInvoiceData.invoiceNumber);
    const sanitizedInvoiceDate = sanitizeFilename(currentInvoiceData.invoiceDate); // Ensure date is also sanitized

    const pdfFilename = `[invoice]_provider_${sanitizedProviderName}_number_${sanitizedInvoiceNumber}_date_${sanitizedInvoiceDate}_ndis_participant_${sanitizedParticipantName}.pdf`;


    const opt = {
        margin:       [10, 10, 10, 10], // Margins in mm [top, left, bottom, right]
        filename:     pdfFilename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, scrollY: -window.scrollY }, // scrollY to capture full page
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(tempDiv).set(opt).save().then(async () => {
        showMessage("PDF Generated", "Invoice PDF has been downloaded.");
        tempDiv.remove(); // Clean up the temporary div
        // Potentially save the generated invoice to Firestore history here if needed
    }).catch(err => {
        console.error("PDF Export Error", err);
        logErrorToFirestore("generateInvoicePdf", err.message, err);
        showMessage("PDF Error", "Could not generate PDF: " + err.message);
        tempDiv.remove();
    });
};


// Agreement Page & Signature Functions
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

    const signatureDataUrl = canvas.toDataURL('image/png'); // Get signature as base64 PNG
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas after capture

    if (!currentUserId || !fsDb) {
        showMessage("Error", "Cannot save signature. User or database not ready.");
        closeModal('sigModal');
        return;
    }
    showLoading("Saving signature...");

    let agreementDocPath;
    let workerProfileForAgreement; // The profile of the worker whose agreement is being signed

    if (profile.isAdmin && currentAgreementWorkerEmail) { // Admin is managing another worker's agreement
        workerProfileForAgreement = accounts[currentAgreementWorkerEmail]?.profile;
        if (!workerProfileForAgreement) {
            hideLoading();
            showMessage("Error", "Selected worker profile not found for agreement.");
            closeModal('sigModal');
            return;
        }
        agreementDocPath = `artifacts/${appId}/users/${workerProfileForAgreement.uid}/agreements/main`;
    } else if (!profile.isAdmin && currentUserId) { // User is signing their own agreement
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
    } else if (signingAs === 'participant') { // Assuming admin can sign as participant proxy or participant signs themselves
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
    updateData.updatedBy = currentUserId; // Who performed the action


    try {
        const agreementInstanceRef = doc(fsDb, agreementDocPath);
        await setDoc(agreementInstanceRef, updateData, { merge: true }); // Merge to update existing fields

        // Update UI immediately if possible (or rely on loadServiceAgreement to refresh)
        const currentAgreementInstance = await getDoc(agreementInstanceRef); // Fetch updated data
        if(currentAgreementInstance.exists()){
            const updatedInstance = currentAgreementInstance.data();
            if (signingAs === 'worker') {
                if($("#sigW")) $("#sigW").src = updatedInstance.workerSigUrl;
                if($("#dW")) $("#dW").textContent = formatDateForInvoiceDisplay(updatedInstance.workerSignDate.toDate());
            } else { // participant
                if($("#sigP")) $("#sigP").src = updatedInstance.participantSigUrl;
                if($("#dP")) $("#dP").textContent = formatDateForInvoiceDisplay(updatedInstance.participantSignDate.toDate());
            }
        }

        loadServiceAgreement(); // Reload the agreement to reflect changes
        showMessage("Signature Saved", "Your signature has been saved to the agreement.");
    } catch (error) {
        console.error("Error saving signature:", error);
        logErrorToFirestore("saveSig", error.message, error);
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


// User Setup Wizard Functions
function openUserSetupWizard(isEditing = false) {
    const wizModal = $("#wiz");
    if (wizModal) {
        userWizStep = 1; // Reset to first step

        const wHead = $("#wHead");
        if (wHead) wHead.textContent = isEditing ? "Edit Your Profile" : "Step 1: Basic Info";

        // Pre-fill with existing profile data if available
        if ($("#wName") && profile && profile.name) $("#wName").value = profile.name;
        if ($("#wAbn") && profile && profile.abn) $("#wAbn").value = profile.abn;
        if ($("#wGst") && profile && profile.gstRegistered !== undefined) $("#wGst").checked = profile.gstRegistered;
        if ($("#wBsb") && profile && profile.bsb) $("#wBsb").value = profile.bsb;
        if ($("#wAcc") && profile && profile.acc) $("#wAcc").value = profile.acc;
        // Files are handled separately, not simple pre-fill here

        updateUserWizardView(); // Show the first step

        wizModal.classList.remove('hide');
        wizModal.style.display = "flex";
        if (!isEditing) { // Only show welcome if it's initial setup
            showMessage("Welcome!", "Please complete your profile setup to continue.");
        }
    }
}

function updateUserWizardView() {
    // Hide all steps, remove active from all indicators
    $$("#wiz .wizard-step-content").forEach(el => el.classList.add('hide'));
    $$("#wiz .wizard-step-indicator").forEach(el => el.classList.remove('active'));

    // Show current step, activate current indicator
    const currentStepContent = $(`#wStep${userWizStep}`);
    const currentStepIndicator = $(`#wizStepIndicator${userWizStep}`);

    if (currentStepContent) currentStepContent.classList.remove('hide');
    if (currentStepIndicator) currentStepIndicator.classList.add('active');

    // Update wizard header based on step (optional)
    // const wHead = $("#wHead");
    // if (wHead) wHead.textContent = `Step ${userWizStep}: ...`;
}

window.wizNext = function() {
    // Validate current step before proceeding
    if (userWizStep === 1) { // Basic Info
        const name = $("#wName")?.value.trim();
        let abn = $("#wAbn")?.value.trim();
        if (abn) abn = abn.replace(/\D/g, ''); // Remove non-digits
        $("#wAbn").value = abn; // Update input with cleaned ABN

        if (!name) { return showMessage("Validation Error", "Full name is required."); }
        if (globalSettings.portalType === 'organization' && abn && !isValidABN(abn)) { // ABN only required if org portal
            return showMessage("Validation Error", "Please enter a valid 11-digit ABN.");
        }
        if (globalSettings.portalType === 'organization' && !abn) { return showMessage("Validation Error", "ABN is required for organization workers."); }

    } else if (userWizStep === 2) { // Bank Details
        let bsb = $("#wBsb")?.value.trim();
        let acc = $("#wAcc")?.value.trim();
        if (bsb) bsb = bsb.replace(/\D/g, ''); // Clean BSB
        if (acc) acc = acc.replace(/\D/g, ''); // Clean Account
        $("#wBsb").value = bsb;
        $("#wAcc").value = acc;

         if (globalSettings.portalType === 'organization') { // Bank details only required if org portal
            if (bsb && !isValidBSB(bsb)) { return showMessage("Validation Error", "Please enter a valid 6-digit BSB.");}
            if (acc && !isValidAccountNumber(acc)) { return showMessage("Validation Error", "Please enter a valid account number (6-10 digits).");}
            if (!bsb) { return showMessage("Validation Error", "BSB is required for organization workers."); }
            if (!acc) { return showMessage("Validation Error", "Account number is required for organization workers."); }
        }
    } // Add validation for step 3 (Files) if needed, though files are usually optional uploads

    if (userWizStep < 4) { // Assuming 4 steps (Basic, Bank, Files, Review/Confirm)
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

    // Final validation of all required fields, similar to wizNext logic
    const nameValue = $("#wName")?.value.trim();
    let abnValue = $("#wAbn")?.value.trim().replace(/\D/g, '');
    let bsbValue = $("#wBsb")?.value.trim().replace(/\D/g, '');
    let accValue = $("#wAcc")?.value.trim().replace(/\D/g, '');

    // Update input fields with cleaned values for user visibility
    if ($("#wAbn")) $("#wAbn").value = abnValue;
    if ($("#wBsb")) $("#wBsb").value = bsbValue;
    if ($("#wAcc")) $("#wAcc").value = accValue;

    if (!nameValue) { return showMessage("Validation Error", "Full name is required to finish setup."); }

    if (globalSettings.portalType === 'organization') { // Stricter validation for organization workers
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
        abn: abnValue || profile.abn || "", // Use new value, or keep old if new is empty (unless required)
        gstRegistered: $("#wGst")?.checked || false,
        bsb: bsbValue || profile.bsb || "",
        acc: accValue || profile.acc || "",
        profileSetupComplete: true, // Mark setup as complete
        lastUpdated: serverTimestamp(),
        updatedBy: currentUserId
    };
     if (!profile.createdAt) { // If this is the very first save of the profile
        profileUpdates.createdAt = serverTimestamp();
        profileUpdates.createdBy = currentUserId;
    }


    try {
        const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        await updateDoc(userProfileDocRef, profileUpdates); // Use updateDoc to merge with existing profile

        // Update local profile object
        profile = { ...profile, ...profileUpdates };
        // Update accounts cache
        if (accounts[currentUserEmail]) {
            accounts[currentUserEmail].profile = profile;
        } else if (accounts[currentUserId]) { // Fallback if email is not the key
            accounts[currentUserId].profile = profile;
        }

        hideLoading();
        closeModal('wiz');
        showMessage("Profile Updated", "Your profile details have been saved successfully.");
        enterPortal(profile.isAdmin); // Re-evaluate portal entry (e.g., if setup is now complete)
        if(location.hash === "#profile") loadProfileData(); // Refresh profile page if currently on it

    } catch (error) {
        hideLoading();
        console.error("Error saving profile from wizard:", error);
        logErrorToFirestore("wizFinish", error.message, error);
        showMessage("Storage Error", "Could not save your profile details: " + error.message);
    }
};

// Shift Request Modal Functions
window.saveRequest = async function() {
    if (!currentUserId || !fsDb) {
        showMessage("Error", "Cannot save request. User not logged in or database not ready.");
        return;
    }

    const requestDate = $("#rqDate")?.value;
    const requestStartTime = $("#rqStart")?.dataset.value24; // Get 24hr format
    const requestEndTime = $("#rqEnd")?.dataset.value24;   // Get 24hr format
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
        userName: profile.name || currentUserEmail, // Use profile name if available
        date: requestDate,
        startTime: requestStartTime,
        endTime: requestEndTime,
        reason: requestReason || "", // Optional reason
        status: "pending", // Initial status
        requestedAt: serverTimestamp(),
        requestedBy: currentUserId
    };

    try {
        // Save to a public collection for admin review
        const requestsCollectionRef = collection(fsDb, `artifacts/${appId}/public/data/shiftRequests`);
        const newRequestRef = await fsAddDoc(requestsCollectionRef, requestData); // Firestore generates ID

        hideLoading();
        closeModal('rqModal');
        showMessage("Request Submitted", "Your shift request has been submitted successfully.");
        // Refresh the requests list if the user is on the home page
        if (location.hash === "#home") {
            loadShiftRequestsForUserDisplay();
        }
    } catch (error) {
        hideLoading();
        console.error("Error submitting shift request:", error);
        logErrorToFirestore("saveRequest", error.message, error);
        showMessage("Storage Error", "Could not submit your shift request: " + error.message);
    }
};

// Initial Invoice Number Modal
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
            lastUpdated: serverTimestamp(),
            updatedBy: currentUserId
        });
        profile.nextInvoiceNumber = initialNumber; // Update local profile

        // If on invoice page, update the displayed invoice number
        if (location.hash === "#invoice") {
            $("#invNo").value = formatInvoiceNumber(initialNumber);
        }

        hideLoading();
        closeModal('setInitialInvoiceModal');
        showMessage("Invoice Number Set", `Starting invoice number set to ${initialNumber}.`);
    } catch (error) {
        hideLoading();
        console.error("Error saving initial invoice number:", error);
        logErrorToFirestore("saveInitialInvoiceNumber", error.message, error);
        showMessage("Storage Error", "Could not save starting invoice number: " + error.message);
    }
};

// Log Shift Modal (for adding to invoice)
window.saveShiftFromModalToInvoice = function() {
    const shiftDate = $("#logShiftDate")?.value;
    const supportTypeCode = $("#logShiftSupportType")?.value;
    const startTime = $("#logShiftStartTime")?.dataset.value24; // 24hr format
    const endTime = $("#logShiftEndTime")?.dataset.value24;   // 24hr format
    const claimTravel = $("#logShiftClaimTravelToggle")?.checked;
    const startKm = parseFloat($("#logShiftStartKm")?.value); // Odometer start
    const endKm = parseFloat($("#logShiftEndKm")?.value);     // Odometer end

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
    // Check if service is authorized for the user (if not admin)
    if (!profile.isAdmin && !(profile.authorizedServiceCodes?.includes(supportTypeCode))) { // Use supportTypeCode here
        return showMessage("Unauthorized Service", "You are not authorized to use this service code.");
    }


    // Add the main service row to the invoice
    addInvoiceRow({
        date: shiftDate,
        serviceCode: supportTypeCode,
        startTime: startTime,
        endTime: endTime,
        // travelKmInput and claimTravel will be handled by addInvoiceRow's logic if needed
    });

    // If "Claim Travel" is checked for this shift AND a travel service is associated
    if (claimTravel) {
        const calculatedKm = parseFloat($("#logShiftCalculatedKm")?.textContent) || 0; // Get calculated Km
        if (calculatedKm <= 0) {
            showMessage("Travel Warning", "Calculated travel is 0 Km. Travel row not added. Please check odometer readings.");
        } else {
            const travelServiceCode = service.travelCode; // Get associated travel code from the main service
            const travelService = adminManagedServices.find(s => s.code === travelServiceCode && s.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM);
            if (travelService) {
                addInvoiceRow({
                    date: shiftDate, // Same date as the shift
                    serviceCode: travelService.code,
                    travelKmInput: calculatedKm, // Pass the calculated Km
                    claimTravel: true // Mark this row as a travel claim explicitly if needed by addInvoiceRow logic
                });
            } else {
                showMessage("Travel Error", `Associated travel service code (${travelServiceCode || 'N/A'}) not found or not configured as 'Travel - Per Kilometre'. Travel not added.`);
            }
        }
    }

    calculateInvoiceTotals(); // Recalculate after adding rows
    closeModal('logShiftModal');
    showMessage("Shift Added", "Shift details have been added to the current invoice.");
};


// --- Admin Setup Wizard (#adminSetupWizard) Functions ---
function openAdminSetupWizard() {
    const modal = $("#adminSetupWizard");
    if(modal) {
        adminWizStep = 1; // Start from step 1
        // Pre-select portal type based on current global settings
        const currentPortalType = globalSettings.portalType || 'organization'; // Default to organization
        const portalTypeRadio = $(`input[name="adminWizPortalType"][value="${currentPortalType}"]`);
        if (portalTypeRadio) portalTypeRadio.checked = true;

        updateAdminWizardView(); // Display the first step
        modal.style.display = "flex"; // Show the modal
    }
}

function updateAdminWizardView() {
    // Hide all step content and deactivate all indicators
    $$("#adminSetupWizard .wizard-step-content").forEach(el => el.classList.add('hide'));
    $$("#adminSetupWizard .wizard-step-indicator").forEach(el => el.classList.remove('active'));

    // Show current step content and activate current indicator
    const currentStepContent = $(`#adminWizStep${adminWizStep}`);
    const currentStepIndicator = $(`#adminWizStepIndicator${adminWizStep}`);
    if (currentStepContent) currentStepContent.classList.remove('hide');
    if (currentStepIndicator) currentStepIndicator.classList.add('active');

    // Update titles and field visibility based on current step and portal type selection
    const adminWizHead = $("#adminWizHead");
    const adminWizStep2Title = $("#adminWizStep2Title");
    const adminWizStep3Title = $("#adminWizStep3Title");
    const adminWizOrgFields = $("#adminWizOrgFields"); // Div containing org-specific fields
    const adminWizUserFields = $("#adminWizUserFields"); // Div containing self-managed user fields

    if (adminWizStep === 1) {
        if (adminWizHead) adminWizHead.innerHTML = `<i class="fas fa-magic"></i> Portal Setup - Step 1: Portal Type`;
        // Pre-fill portal type from globalSettings if available
        const portalType = globalSettings.portalType || 'organization';
        const portalTypeRadio = $(`input[name="adminWizPortalType"][value="${portalType}"]`);
        if (portalTypeRadio) portalTypeRadio.checked = true;

    } else if (adminWizStep === 2) { // Organization/User Details
        const portalType = document.querySelector('input[name="adminWizPortalType"]:checked')?.value || globalSettings.portalType || 'organization';
        if (adminWizHead) adminWizHead.innerHTML = `<i class="fas fa-magic"></i> Portal Setup - Step 2: Details`;
        if (portalType === 'organization') {
            if (adminWizStep2Title) adminWizStep2Title.textContent = "Step 2: Organization Details";
            if (adminWizOrgFields) adminWizOrgFields.classList.remove('hide');
            if (adminWizUserFields) adminWizUserFields.classList.add('hide');
            // Pre-fill from globalSettings
            if ($("#adminWizOrgName")) $("#adminWizOrgName").value = globalSettings.organizationName || "";
            if ($("#adminWizOrgAbn")) $("#adminWizOrgAbn").value = globalSettings.organizationAbn || "";
            if ($("#adminWizOrgContactEmail")) $("#adminWizOrgContactEmail").value = globalSettings.organizationContactEmail || "";
            if ($("#adminWizOrgContactPhone")) $("#adminWizOrgContactPhone").value = globalSettings.organizationContactPhone || "";
        } else { // Self-Managed Participant
            if (adminWizStep2Title) adminWizStep2Title.textContent = "Step 2: Your Details";
            if (adminWizOrgFields) adminWizOrgFields.classList.add('hide');
            if (adminWizUserFields) adminWizUserFields.classList.remove('hide');
            // Pre-fill from globalSettings or admin's profile
            if ($("#adminWizUserName")) $("#adminWizUserName").value = globalSettings.adminUserName || profile.name || "";
        }
    } else if (adminWizStep === 3) { // Participant Details
        if (adminWizHead) adminWizHead.innerHTML = `<i class="fas fa-magic"></i> Portal Setup - Step 3: Participant Details`;
        const portalType = document.querySelector('input[name="adminWizPortalType"]:checked')?.value || globalSettings.portalType || 'organization';
        if (adminWizStep3Title) adminWizStep3Title.textContent = portalType === 'organization' ? "Step 3: Default Participant Details" : "Step 3: Your (Participant) Plan Details";

        // Pre-fill from globalSettings
        if ($("#adminWizParticipantName")) $("#adminWizParticipantName").value = globalSettings.participantName || "";
        if ($("#adminWizParticipantNdisNo")) $("#adminWizParticipantNdisNo").value = globalSettings.participantNdisNo || "";
        if ($("#adminWizPlanManagerName")) $("#adminWizPlanManagerName").value = globalSettings.planManagerName || "";
        if ($("#adminWizPlanManagerEmail")) $("#adminWizPlanManagerEmail").value = globalSettings.planManagerEmail || "";
        if ($("#adminWizPlanManagerPhone")) $("#adminWizPlanManagerPhone").value = globalSettings.planManagerPhone || "";
        if ($("#adminWizPlanEndDate")) $("#adminWizPlanEndDate").value = globalSettings.planEndDate || "";
    }
}

window.adminWizNext = function() {
    // Validation for current step
    if (adminWizStep === 1) {
        // No specific validation for step 1 (portal type selection)
        // The selected value will be read in step 2 or finish
        updateAdminWizardView(); // Update view to reflect selection if any dynamic changes occur
    } else if (adminWizStep === 2) { // Org/User Details
        const portalType = document.querySelector('input[name="adminWizPortalType"]:checked')?.value;
        if (portalType === 'organization') {
            const orgName = $("#adminWizOrgName")?.value.trim();
            let orgAbn = $("#adminWizOrgAbn")?.value.trim();
            if(orgAbn) orgAbn = orgAbn.replace(/\D/g, ''); // Clean ABN
            $("#adminWizOrgAbn").value = orgAbn; // Update input with cleaned value

            if (!orgName) { return showMessage("Validation Error", "Organization Name is required for 'Organization' type.");}
            if (orgAbn && !isValidABN(orgAbn)) { return showMessage("Validation Error", "Invalid ABN. Please enter an 11-digit ABN.");}
            // Optional: Validate contact email/phone format if entered
        } else { // Self-Managed Participant
            if (!$("#adminWizUserName")?.value.trim()) {
                return showMessage("Validation Error", "Your Name is required for 'Self-Managed Participant' type.");
            }
        }
    }
    // No specific validation for step 3 (Participant Details) before 'Next', will be validated on 'Finish'

    if (adminWizStep < 3) { // Assuming 3 steps
        adminWizStep++;
        updateAdminWizardView();
    } else {
        console.log("Already on the last step of admin wizard.");
        // Or, if 'Next' on the last step should trigger 'Finish':
        // adminWizFinish();
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

    // Collect all data from the wizard
    const portalTypeSelected = document.querySelector('input[name="adminWizPortalType"]:checked')?.value;
    if (!portalTypeSelected) { // Should have been selected in Step 1
        showMessage("Validation Error", "Please select a Portal Type in Step 1.");
        adminWizStep = 1; // Go back to step 1
        updateAdminWizardView();
        return;
    }

    let tempGlobalSettings = { // Create a temporary object to hold new settings
        portalType: portalTypeSelected,
        participantName: $("#adminWizParticipantName")?.value.trim() || "Default Participant",
        participantNdisNo: $("#adminWizParticipantNdisNo")?.value.trim() || "",
        planManagerName: $("#adminWizPlanManagerName")?.value.trim() || "",
        planManagerEmail: $("#adminWizPlanManagerEmail")?.value.trim() || "",
        planManagerPhone: $("#adminWizPlanManagerPhone")?.value.trim() || "",
        planEndDate: $("#adminWizPlanEndDate")?.value || "", // Ensure it's a valid date string or handle conversion
        setupComplete: true, // Mark setup as complete
        lastUpdated: serverTimestamp(), // Add audit field
        // Preserve existing rate multipliers and agreement start date if not set in wizard
        rateMultipliers: globalSettings.rateMultipliers || { weekday: 1.00, evening: 1.10, night: 1.14, saturday: 1.41, sunday: 1.81, public: 2.22 },
        agreementStartDate: globalSettings.agreementStartDate || new Date().toISOString().split('T')[0]
    };

    if (portalTypeSelected === 'organization') {
        tempGlobalSettings.organizationName = $("#adminWizOrgName")?.value.trim();
        tempGlobalSettings.organizationAbn = $("#adminWizOrgAbn")?.value.trim().replace(/\D/g, '') || ""; // Sanitize
        tempGlobalSettings.organizationContactEmail = $("#adminWizOrgContactEmail")?.value.trim() || "";
        tempGlobalSettings.organizationContactPhone = $("#adminWizOrgContactPhone")?.value.trim() || "";
        tempGlobalSettings.adminUserName = profile.name; // Admin's name from their profile

        // Validations for organization type
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

    } else { // Self-Managed Participant
        tempGlobalSettings.adminUserName = $("#adminWizUserName")?.value.trim();
        // For self-managed, organization name can be the admin's name or a generic portal name
        tempGlobalSettings.organizationName = tempGlobalSettings.adminUserName || profile.name || "Participant Portal"; 
        // Clear org-specific fields if switching to participant type
        tempGlobalSettings.organizationAbn = "";
        tempGlobalSettings.organizationContactEmail = "";
        tempGlobalSettings.organizationContactPhone = "";

        if (!tempGlobalSettings.adminUserName) {
            showMessage("Validation Error", "Your Name is required for 'Self-Managed Participant' type (Step 2).");
            adminWizStep = 2; updateAdminWizardView(); return;
        }
        // If admin's name changed in wizard, update their profile too
        if (profile.uid === currentUserId && tempGlobalSettings.adminUserName !== profile.name) {
            const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
            try {
                await updateDoc(userProfileDocRef, { name: tempGlobalSettings.adminUserName });
                profile.name = tempGlobalSettings.adminUserName; // Update local profile
            } catch (e) { console.error("Error updating admin's name during participant setup:", e); }
        }
        // For self-managed, participant name is the admin's name
        tempGlobalSettings.participantName = tempGlobalSettings.adminUserName;
    }

    // Common validations for participant details (Step 3)
    if (!tempGlobalSettings.participantName && portalTypeSelected === 'organization') { // Required for org type
        showMessage("Validation Error", "Default Participant Name is required (Step 3).");
        adminWizStep = 3; updateAdminWizardView(); return;
    }
     if (!tempGlobalSettings.participantName && portalTypeSelected === 'participant') { // Should be set from adminUserName
        tempGlobalSettings.participantName = tempGlobalSettings.adminUserName; // Ensure it's set
    }
    if (tempGlobalSettings.planManagerEmail && !validateEmail(tempGlobalSettings.planManagerEmail)) {
        showMessage("Validation Error", "Invalid Plan Manager Email format (Step 3).");
        adminWizStep = 3; updateAdminWizardView(); return;
    }

    showLoading("Finalizing portal setup...");
    globalSettings = { ...globalSettings, ...tempGlobalSettings }; // Merge new settings into global state

    try {
        await saveGlobalSettingsToFirestore(); // Save to Firestore
        hideLoading();
        closeModal('adminSetupWizard');
        showMessage("Setup Complete", "Portal has been configured successfully.");
        enterPortal(true); // Re-enter portal as admin to reflect changes
        if(location.hash === "#admin") { // If already on admin page, refresh its content
            loadAdminPortalSettings(); // Reload settings on admin page
            setActive("#admin"); // Ensure admin page is active
        }

    } catch (error) {
        hideLoading();
        console.error("Error finalizing admin setup:", error);
        logErrorToFirestore("adminWizFinish", error.message, error);
        showMessage("Storage Error", "Could not save portal configuration: " + error.message);
    }
};
// --- End Admin Setup Wizard Functions ---


// Utility & Navigation
window.copyLink = function(){ const inviteLinkElement = $("#invite"); const link = inviteLinkElement ? inviteLinkElement.textContent : null; if (link && navigator.clipboard) { navigator.clipboard.writeText(link).then(()=>showMessage("Copied","Invite link copied to clipboard!")).catch(err=>showMessage("Copy Error","Could not copy link: " + err)); } else if (link) { const textArea = document.createElement("textarea"); textArea.value = link; document.body.appendChild(textArea); textArea.focus(); textArea.select(); try { document.execCommand('copy'); showMessage("Copied","Invite link copied!"); } catch (err) { showMessage("Copy Error","Failed to copy link."); } document.body.removeChild(textArea); } else { showMessage("Error", "Invite link not found."); }};

// Admin: Worker Management
async function loadAllUserAccountsForAdminFromFirestore() {
    if (!isFirebaseInitialized || !(profile && profile.isAdmin)) {
        console.warn("Admin data load skipped: Firebase not ready or user not admin.");
        return;
    }
    showLoading("Loading user accounts...");
    try {
        const usersCollectionRef = collection(fsDb, `artifacts/${appId}/users`);
        const usersSnapshot = await getDocs(usersCollectionRef);

        const tempAccounts = {};
        pendingApprovalAccounts = []; // Clear previous pending list
        const profilePromises = [];

        usersSnapshot.forEach((userDocSnapshot) => {
            const userId = userDocSnapshot.id;
            // For each user document, get their profile details
            const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${userId}/profile`, "details");
            profilePromises.push(
                getDoc(userProfileDocRef).then(profileSnap => {
                    if (profileSnap.exists()) {
                        const userData = profileSnap.data();
                        const userAccount = { name: userData.name || 'Unnamed User', profile: { uid: userId, ...userData } }; // Ensure UID is part of profile object

                        // Store in accounts cache, preferably by email if available
                        if (userData.email) {
                            tempAccounts[userData.email] = userAccount;
                        } else {
                            tempAccounts[userId] = userAccount; // Fallback if email is missing
                        }

                        // Populate pending approval list for non-admin, non-approved users
                        if (!userData.isAdmin && userData.approved === false) { // Check for explicit false
                            pendingApprovalAccounts.push(userAccount.profile);
                        }

                    } else {
                        console.warn(`Profile details not found for user ID: ${userId}`);
                        // Optionally create a placeholder if needed, or skip
                    }
                }).catch(err => {
                    console.error(`Error fetching profile for user ID ${userId}:`, err);
                    logErrorToFirestore("loadAllUserAccounts_getDoc", err.message, {userId, err});
                })
            );
        });
        await Promise.all(profilePromises); // Wait for all profile fetches

        accounts = tempAccounts; // Update global accounts cache
        console.log("Loaded accounts for admin (includes admin):", accounts);
        console.log("Pending approval accounts:", pendingApprovalAccounts);


        // Refresh UI elements that depend on this data, if they are currently visible
        if(location.hash === "#agreement" && $("#adminAgreementWorkerSelector")) populateAdminWorkerSelectorForAgreement();
        if(location.hash === "#admin"){
            // If adminWorkerManagement tab is active, refresh its content
            if($(".admin-tab-btn.active")?.dataset.target === "adminWorkerManagement") {
                displayWorkersForAuth(); // List of approved workers
                displayPendingWorkersForAdmin(); // List of pending workers
            }
        }

    } catch (error) {
        console.error("Error loading user accounts for admin from Firestore:", error);
        logErrorToFirestore("loadAllUserAccountsForAdminFromFirestore", error.message, error);
        showMessage("Data Error", "Could not load worker accounts for admin: " + error.message);
    } finally {
        hideLoading();
    }
}

function displayPendingWorkersForAdmin() {
    const ul = $("#pendingWorkersList");
    if (!ul) {
        console.warn("Element #pendingWorkersList not found for displaying pending workers. Ensure it exists in index.html within the adminWorkerManagement panel.");
        return;
    }
    ul.innerHTML = ""; // Clear previous list
    if (pendingApprovalAccounts.length === 0) {
        ul.innerHTML = "<li>No workers currently awaiting approval.</li>";
        return;
    }
    pendingApprovalAccounts.forEach(worker => {
        const li = document.createElement("li");
        li.dataset.uid = worker.uid;

        const icon = document.createElement("i");
        icon.className = "fas fa-user-clock";
        li.appendChild(icon);

        li.appendChild(document.createTextNode(` ${worker.name || 'Unnamed Worker'} `));

        const small = document.createElement("small");
        small.textContent = `(${worker.email || worker.uid})`;
        li.appendChild(small);

        const approveButton = document.createElement("button");
        approveButton.className = "btn-ok btn-small";
        approveButton.title = "Approve Worker";
        approveButton.innerHTML = '<i class="fas fa-check"></i> Approve'; // Added icon

        // Programmatically attach event listener
        approveButton.addEventListener('click', () => {
            if (typeof approveWorkerInFirestore === 'function') {
                approveWorkerInFirestore(worker.uid);
            } else {
                console.error("approveWorkerInFirestore is not a function when button clicked. Check script loading order and global assignments.");
                showMessage("Critical Error", "Approval function is not available. Please contact support.");
                logErrorToFirestore("displayPendingWorkers_click", "approveWorkerInFirestore not a function", { workerUid: worker.uid });
            }
        });
        li.appendChild(approveButton);
        ul.appendChild(li);
    });
}

async function approveWorkerInFirestore(workerId) {
    console.log(`[ADMIN APPROVAL CALLED] workerId received: ${workerId}`); // DEBUG LOG
    if (!isFirebaseInitialized || !fsDb || !(profile && profile.isAdmin)) {
        showMessage("Error", "Cannot approve worker. System not ready or insufficient permissions.");
        return;
    }
    if (!workerId) { // Should not happen if called from UI with a UID
        showMessage("Error", "Worker ID not provided for approval.");
        return;
    }

    showLoading(`Approving worker ${workerId}...`);
    try {
        const workerProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${workerId}/profile`, "details");
        console.log(`[ADMIN APPROVAL] Attempting to update Firestore for path: ${workerProfileDocRef.path}`); // DEBUG LOG

        await updateDoc(workerProfileDocRef, {
            approved: true,
            lastUpdated: serverTimestamp(),
            updatedBy: currentUserId // Admin's ID
        });
        console.log(`[ADMIN APPROVAL] Successfully updated Firestore for workerId: ${workerId}. 'approved' should now be true.`); // DEBUG LOG

        // Update local 'accounts' and 'pendingApprovalAccounts' for immediate UI refresh for the admin
        const workerEmail = Object.keys(accounts).find(key => accounts[key]?.profile?.uid === workerId);
        if (workerEmail && accounts[workerEmail]?.profile) {
            accounts[workerEmail].profile.approved = true;
            console.log(`[ADMIN APPROVAL] Updated local 'accounts' cache for email key: ${workerEmail}`);
        } else if (accounts[workerId]?.profile) { // Fallback if email was not the key or user is keyed by UID
            accounts[workerId].profile.approved = true;
            console.log(`[ADMIN APPROVAL] Updated local 'accounts' cache for UID key: ${workerId}`);
        } else {
            console.warn(`[ADMIN APPROVAL] Could not find worker ${workerId} in local 'accounts' cache to update 'approved' status.`);
            // If not in cache, it will be correctly loaded next time, but UI might not update immediately without full reload.
        }

        const initialPendingCount = pendingApprovalAccounts.length;
        pendingApprovalAccounts = pendingApprovalAccounts.filter(p => p.uid !== workerId); // Remove from pending list
        console.log(`[ADMIN APPROVAL] Updated 'pendingApprovalAccounts'. Count changed from ${initialPendingCount} to ${pendingApprovalAccounts.length}.`);


        // Refresh admin's display of pending and authorized workers
        displayPendingWorkersForAdmin(); // Update the list of pending workers
        displayWorkersForAuth(); // Refresh the main list too, as they are now approved and should appear there

        showMessage("Worker Approved", `Worker ${workerId} has been approved.`);

    } catch (error) {
        console.error(`[ADMIN APPROVAL] Firestore update FAILED for workerId: ${workerId}`, error); // DEBUG LOG with error
        logErrorToFirestore("approveWorkerInFirestore", error.message, { workerId, error });
        showMessage("Error", `Could not approve worker: ${error.message}`);
    } finally {
        hideLoading();
    }
}


function displayWorkersForAuth() {
    const ul = $("#workersListForAuth");
    if (!ul) {
        console.error("CRITICAL: UI Element #workersListForAuth not found in the HTML. This is required for displaying workers for authorization. Please check the adminWorkerManagement panel in your HTML file.");
        // Optionally, provide some fallback UI or message in the admin panel itself
        const adminWorkerPanel = $("#adminWorkerManagement"); // Assuming this is the parent panel
        if (adminWorkerPanel && !adminWorkerPanel.querySelector('#workersListForAuthError')) { // Avoid adding multiple error messages
            const errorP = document.createElement('p');
            errorP.id = "workersListForAuthError";
            errorP.style.color = "red";
            errorP.innerHTML = "Error: UI component <code>#workersListForAuth</code> is missing. Worker list cannot be displayed. Please check HTML.";
            // Prepend error to the panel if it exists
            if (adminWorkerPanel.firstChild) {
                adminWorkerPanel.insertBefore(errorP, adminWorkerPanel.firstChild);
            } else {
                adminWorkerPanel.appendChild(errorP);
            }
        }
        return;
    }
    // If error message was previously added, remove it now that ul is found (or will be populated)
    const existingErrorMsg = $("#workersListForAuthError");
    if (existingErrorMsg) existingErrorMsg.remove();

    ul.innerHTML = ""; // Clear previous list

    // Filter accounts to get only non-admin, approved workers, excluding the current admin user
    const workerAccounts = Object.entries(accounts).filter(([key, acc]) => {
        return acc && acc.profile && !acc.profile.isAdmin && acc.profile.uid !== currentUserId && acc.profile.approved === true; // Only show approved workers
    });

    console.log("Displaying workers for auth (filtered and approved):", workerAccounts);

    if (workerAccounts.length === 0) {
        ul.innerHTML = "<li>No approved workers found. Check pending approvals.</li>";
        const selectedWorkerNameEl = $("#selectedWorkerNameForAuth");
        if (selectedWorkerNameEl) selectedWorkerNameEl.innerHTML = `<i class="fas fa-user-check"></i> Select a Worker`;
        const servicesContainerEl = $("#servicesForWorkerContainer");
        if (servicesContainerEl) servicesContainerEl.classList.add("hide"); // Hide services section
        return;
    }

    workerAccounts.forEach(([key, worker]) => {
        const displayIdentifier = worker.profile.email || key; // Use email or key (UID)
        const li = document.createElement("li");
        li.innerHTML = `<i class="fas fa-user-tie"></i> ${worker.profile.name || 'Unnamed Worker'} <small>(${displayIdentifier})</small>`;
        li.dataset.key = key; // Store the key (email or UID) used to access 'accounts'
        li.onclick = () => selectWorkerForAuth(key); // Call with the key
        ul.appendChild(li);
    });
}


function selectWorkerForAuth(key) { // key is the identifier used in 'accounts' (email or UID)
    selectedWorkerEmailForAuth = key; // Store the key for saving authorizations
    const worker = accounts[selectedWorkerEmailForAuth];
    const nameEl = $("#selectedWorkerNameForAuth");
    const containerEl = $("#servicesForWorkerContainer"); // Container for service checkboxes

    if (!worker || !worker.profile) {
        showMessage("Error", "Selected worker data not found.");
        if(nameEl) nameEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error loading worker`;
        if(containerEl) containerEl.classList.add("hide");
        return;
    }
    if(nameEl) nameEl.innerHTML = `<i class="fas fa-user-check"></i> Authorizing: <strong>${worker.profile.name || 'Unnamed Worker'}</strong>`;
    if(containerEl) containerEl.classList.remove("hide"); // Show the services section

    // Highlight the selected worker in the list
    $$("#workersListForAuth li").forEach(li => li.classList.remove("selected-worker-auth"));
    const selectedLi = $(`#workersListForAuth li[data-key="${key}"]`);
    if (selectedLi) selectedLi.classList.add("selected-worker-auth");

    displayServicesForWorkerAuth(worker.profile); // Populate services for this worker
}

function displayServicesForWorkerAuth(workerProfileData) {
    const ul = $("#servicesListCheckboxes"); if (!ul) return; ul.innerHTML = "";
    const authorizedCodes = workerProfileData.authorizedServiceCodes || []; // Get currently authorized codes

    if (adminManagedServices.length === 0) {
        ul.innerHTML = "<li>No NDIS services have been defined by the admin yet.</li>";
        return;
    }

    let servicesAvailable = false;
    adminManagedServices.forEach(service => {
        // Typically, travel services are not directly authorized but linked to other services
        if (service.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM) { 
            servicesAvailable = true;
            const li = document.createElement("li");
            const label = document.createElement("label");
            label.className = "chk"; // For styling checkbox labels
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = service.code; // Store service code in value
            checkbox.checked = authorizedCodes.includes(service.code); // Check if already authorized
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
    const workerUid = accounts[selectedWorkerEmailForAuth].profile.uid; // Get the UID of the selected worker
    if (!workerUid) { // Should always exist if profile exists
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
            lastUpdated: serverTimestamp(),
            updatedBy: currentUserId // Admin's ID
        });

        // Update local cache for the worker
        accounts[selectedWorkerEmailForAuth].profile.authorizedServiceCodes = selectedServiceCodes;
        // If the admin is somehow editing their own non-admin profile (unlikely scenario but safe check)
        if (currentUserId === workerUid && !profile.isAdmin) {
            profile.authorizedServiceCodes = selectedServiceCodes;
        }
        hideLoading();
        showMessage("Success", `Authorizations for ${accounts[selectedWorkerEmailForAuth].profile.name || 'Worker'} saved successfully.`);
    } catch (e) {
        hideLoading();
        console.error("Error saving worker authorizations to Firestore:", e);
        logErrorToFirestore("saveWorkerAuthorizationsToFirestore", e.message, {workerUid, e});
        showMessage("Storage Error", "Could not save worker authorizations: " + e.message);
    }
}

// Navigation & Page Activation
function setActive(hash) {
  // If not authenticated and trying to access a protected page, redirect to auth screen
  if (!currentUserId && (portalAppElement && portalAppElement.style.display === 'none')) { // Not logged in
      if (authScreenElement && authScreenElement.style.display !== 'flex') { // And auth screen not already shown
          if (portalAppElement) portalAppElement.style.display = 'none';
          authScreenElement.style.display = 'flex';
      }
      // Potentially redirect hash to #login or clear it if it's a protected route
      // For now, just ensures auth screen is visible if not logged in.
      return; 
  }

  const currentHash = hash || location.hash || (profile && profile.isAdmin ? "#admin" : "#home"); // Default hash
  // Update active classes for nav links
  $$("nav#side a.link, nav#bottom a.bLink").forEach(a => a.classList.toggle("active", a.hash === currentHash));
  // Show/hide main content sections (cards)
  $$("main section.card").forEach(s => s.classList.toggle("active", `#${s.id}` === currentHash));
  window.scrollTo(0, 0); // Scroll to top on page change

  // Update portal title
  const portalTitleElement = $("#portalTitleDisplay");
  if (portalTitleElement) {
      if (globalSettings?.organizationName && globalSettings.portalType === 'organization') {
          portalTitleElement.innerHTML = `<i class="fas fa-cogs"></i> ${globalSettings.organizationName}`;
      } else if (globalSettings?.portalType === 'participant' && globalSettings?.participantName) {
          // For self-managed, use participant name if org name isn't distinct
          portalTitleElement.innerHTML = `<i class="fas fa-cogs"></i> ${globalSettings.organizationName || globalSettings.participantName}'s Portal`;
      } else if (profile && profile.isAdmin && globalSettings?.organizationName) { // Admin view of org portal
          portalTitleElement.innerHTML = `<i class="fas fa-cogs"></i> ${globalSettings.organizationName}`;
      }
      // Add more conditions or a default if needed
      else {
          portalTitleElement.innerHTML = `<i class="fas fa-cogs"></i> NDIS Portal`;
      }
  }

  // Show/hide nav links based on auth status and role
  $$("nav#side a.link, nav#bottom a.bLink").forEach(a => {
      if (a.hash === "#home") { // Home is always visible
          a.classList.remove('hide');
      } else if (a.hash === "#admin") { // Admin tab visibility
          if (profile && profile.isAdmin) a.classList.remove('hide');
          else a.classList.add('hide');
      } else if (a.id === 'signMyAgreementLink') { // Specific link for user to sign agreement
          const agreementIsSignedByWorker = profile?.agreement?.workerSigned; // Assuming agreement status is in profile
          if (currentUserId && !profile.isAdmin && !agreementIsSignedByWorker) { // Show if user & not admin & not signed
              a.classList.remove('hide');
          } else {
              a.classList.add('hide');
          }
      } else { // Other general links (invoice, profile, agreement view)
          if (currentUserId && !(profile && profile.isAdmin)) a.classList.remove('hide'); // Visible to logged-in non-admins
          else if (profile && profile.isAdmin) a.classList.add('hide'); // Hidden for admins (they use #admin tab)
          else a.classList.add('hide'); // Hidden if not logged in
      }
  });
  // Explicitly manage admin tab in side nav (if separate from bottom nav logic)
  const adminSideNavLink = $("nav#side a.link#adminTab");
  if(adminSideNavLink){
      if (profile && profile.isAdmin) adminSideNavLink.classList.remove('hide');
      else adminSideNavLink.classList.add('hide');
  }

  // Page-specific load functions
  if (currentHash === "#invoice" && !(profile && profile.isAdmin)) handleInvoicePageLoad();
  else if (currentHash === "#profile" && !(profile && profile.isAdmin)) loadProfileData();
  else if (currentHash === "#agreement" || currentHash === "#signMyAgreement") { // Handle both agreement view and direct sign link
      const adminSelector = $("#adminAgreementWorkerSelector");
      const agreementContainer = $("#agreementContentContainer");
      const agrChipEl = $("#agrChip"); // Agreement status chip
      const signBtnEl = $("#signBtn"); // Worker sign button
      const participantSignBtnEl = $("#participantSignBtn"); // Participant sign button
      const pdfBtnEl = $("#pdfBtn"); // PDF download button

      if (profile?.isAdmin && adminSelector) { // Admin viewing agreements
          adminSelector.classList.remove('hide');
          populateAdminWorkerSelectorForAgreement(); // Fill dropdown with workers
          if (agreementContainer) agreementContainer.innerHTML = "<p><em>Select a worker from the dropdown above to view or manage their service agreement.</em></p>";
          if (agrChipEl) { agrChipEl.className = "chip yellow"; agrChipEl.textContent = "Select Worker"; }
          // Hide signing buttons for admin on initial load (they appear after worker selection if needed)
          if (signBtnEl) signBtnEl.classList.add("hide");
          if (participantSignBtnEl) participantSignBtnEl.classList.add("hide");
          if (pdfBtnEl) pdfBtnEl.classList.add("hide");
      } else if (currentUserId && !(profile?.isAdmin)) { // User viewing their own agreement
          if (adminSelector) adminSelector.classList.add('hide');
          currentAgreementWorkerEmail = currentUserEmail; // Set context for their own agreement
          loadServiceAgreement();
      } else { // Not logged in or undetermined state
          if (agreementContainer) agreementContainer.innerHTML = "<p><em>Please log in to view service agreements.</em></p>";
      }
  } else if (currentHash === "#admin" && profile?.isAdmin) { // Admin page setup
    loadAdminPortalSettings(); // Load general portal settings into form
    loadAdminAgreementCustomizations(); // Load agreement template editor
    renderAdminServicesTable(); // Display NDIS services
    loadAdminInvoiceCustomizations(); // Placeholder for invoice template settings

    // Set up admin tab click handlers
    $$('.admin-tab-btn').forEach(btn => {
        btn.removeEventListener('click', handleAdminTabClick); // Remove old listener to prevent duplicates
        btn.addEventListener('click', handleAdminTabClick);
    });

    // Activate the first admin tab or the currently active one
    let activeAdminTab = $('.admin-tab-btn.active');
    let targetAdminPanelId;
    if (!activeAdminTab && $$('.admin-tab-btn').length > 0) { // If no tab is active, click the first one
        $$('.admin-tab-btn')[0].click(); 
    } else if (activeAdminTab) { // If a tab is already active (e.g., from previous state or direct link)
        targetAdminPanelId = activeAdminTab.dataset.target;
        $$('.admin-content-panel').forEach(p => p.classList.remove('active')); // Deactivate all panels
        const targetPanel = $(`#${targetAdminPanelId}`);
        if (targetPanel) targetPanel.classList.add('active'); // Activate the target panel

        // Tab-specific loading logic
        if (targetAdminPanelId === "adminServiceManagement") {
            const categoryTypeSelect = $("#adminServiceCategoryType");
            if (categoryTypeSelect) updateRateFieldsVisibility(categoryTypeSelect.value); // Update rate fields based on selected category
        }
        if (targetAdminPanelId === "adminWorkerManagement") {
            displayWorkersForAuth(); // Display approved workers for authorization
            displayPendingWorkersForAdmin(); // Display workers awaiting approval
        }
        if (targetAdminPanelId === "adminInvoiceCustomization") { /* Future logic for invoice template */ }
    }
  } else if (currentHash === "#home") { // Home page display logic
      handleHomePageDisplay();
  }
}

function handleAdminTabClick(event) {
    const clickedButton = event.currentTarget;
    // Deactivate all tab buttons and activate the clicked one
    $$('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    clickedButton.classList.add('active');

    // Deactivate all content panels and activate the one corresponding to the clicked tab
    $$('.admin-content-panel').forEach(p => p.classList.remove('active'));
    const targetPanelId = clickedButton.dataset.target;
    const targetPanelElement = $(`#${targetPanelId}`);
    if (targetPanelElement) targetPanelElement.classList.add('active');

    // Call specific functions based on which tab was activated
    if (targetPanelId === "adminServiceManagement") {
        const categoryTypeSelect = $("#adminServiceCategoryType");
        if (categoryTypeSelect) updateRateFieldsVisibility(categoryTypeSelect.value);
        // renderAdminServicesTable(); // Might already be loaded, or refresh if needed
    } else if (targetPanelId === "adminWorkerManagement") {
        displayWorkersForAuth(); // For authorizing services
        displayPendingWorkersForAdmin(); // For approving new workers
    } else if (targetPanelId === "adminInvoiceCustomization") {
        console.log("Admin Invoice Customization tab clicked.");
        // Call loadAdminInvoiceCustomizations here if it's meant to load content for this specific tab when clicked
       // loadAdminInvoiceCustomizations(); // Currently a placeholder
    }
    // Add other tab-specific logic as needed
}


function loadAdminInvoiceCustomizations() {
    console.log("loadAdminInvoiceCustomizations called - placeholder");
    const container = $("#adminInvoiceCustomization");
    // Ensure this only populates if it's truly empty or needs refreshing
    if (container && (!container.innerHTML.trim() || container.innerHTML.includes("will be available here"))) {
        container.innerHTML = `<p>Invoice template customization options will be available here in a future update.</p>
                               <p><em>For example, you could allow admins to:</em></p>
                               <ul>
                                 <li>Upload a logo for invoices.</li>
                                 <li>Define default payment terms or bank details.</li>
                                 <li>Customize footer text.</li>
                               </ul>`;
    }
}
// Placeholder for saving customizations
// async function saveAdminInvoiceCustomizations() { // This function is defined later, ensure no conflict
//     showMessage("Info", "Saving invoice customizations is not yet implemented.")
// }


function clearAdminServiceForm() {
    const serviceIdInput = $("#adminServiceId"); if(serviceIdInput) serviceIdInput.value = ""; // Hidden input for ID
    const serviceCodeInput = $("#adminServiceCode"); if(serviceCodeInput) serviceCodeInput.value = "";
    const serviceDescInput = $("#adminServiceDescription"); if(serviceDescInput) serviceDescInput.value = "";
    const categoryTypeSelect = $("#adminServiceCategoryType"); 
    if(categoryTypeSelect) {
        categoryTypeSelect.value = SERVICE_CATEGORY_TYPES.CORE_STANDARD; // Default category
        updateRateFieldsVisibility(SERVICE_CATEGORY_TYPES.CORE_STANDARD); // Update rate fields accordingly
    }
    const travelCodeInput = $("#adminServiceTravelCode"); if(travelCodeInput) travelCodeInput.value = ""; // Hidden input for travel code
    const travelCodeDisplay = $("#adminServiceTravelCodeDisplay"); if(travelCodeDisplay) travelCodeDisplay.value = "None selected"; // Display for selected travel code

    // Reset rate fields (they are dynamically generated, so clearing their container is handled by updateRateFieldsVisibility)
    // Or explicitly clear them if they are static and just shown/hidden:
    // $$('#adminServiceRateFieldsContainer input[type="number"]').forEach(input => input.value = "");


    const formHeader = $("#adminServiceFormContainer h4");
    if(formHeader) formHeader.innerHTML = `<i class="fas fa-plus-square"></i> Add Service`;
}
// DOMContentLoaded - Main Setup
document.addEventListener('DOMContentLoaded', async () => {
    showLoading("Initializing Portal...");
    
    // Initialize Firebase first
    await initializeFirebase(); // This now includes setupAuthListener
const loginBtn    = $("#loginBtn");
    const registerBtn = $("#registerBtn");
    if (loginBtn)    loginBtn.addEventListener("click", modalLogin);
    if (registerBtn) registerBtn.addEventListener("click", modalRegister);
    // If Firebase init failed, isFirebaseInitialized will be false.
    // The initializeFirebase function itself handles showing error messages.
    if (!isFirebaseInitialized) {
        hideLoading(); // Ensure loading is hidden if init fails early
        console.log("[App] Firebase not initialized. Halting further DOM-dependent setup.");
        return; // Stop further setup if Firebase isn't ready
    }



    // Event listeners for admin agreement customization
    const addClauseBtn = $("#adminAddAgreementClauseBtn");
    if (addClauseBtn) addClauseBtn.addEventListener('click', handleAddAgreementClause);
    // Note: remove clause buttons are added dynamically, listeners attached then

    // Event listener for admin service category type change
    const serviceCategoryTypeSelect = $("#adminServiceCategoryType");
    if (serviceCategoryTypeSelect) serviceCategoryTypeSelect.addEventListener('change', (e) => updateRateFieldsVisibility(e.target.value));

    // Event listeners for travel code selection modal (Admin Services)
    const selectTravelCodeBtnEl = $("#selectTravelCodeBtn");
    if (selectTravelCodeBtnEl) selectTravelCodeBtnEl.addEventListener('click', () => {
        const currentServiceCodeBeingEdited = $("#adminServiceCode")?.value; // Exclude current service if it's a travel service itself
        const travelCodeListContainerEl = $("#travelCodeListContainer");
        if (!travelCodeListContainerEl) return;
        travelCodeListContainerEl.innerHTML = ""; // Clear previous list

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
                li.onclick = () => { // Simple selection highlighting
                    $$('#travelCodeListContainer li').forEach(item => item.classList.remove('selected'));
                    li.classList.add('selected');
                };
                ul.appendChild(li);
            });
            travelCodeListContainerEl.appendChild(ul);
        }
        const travelCodeFilterInputEl = $("#travelCodeFilterInput");
        if (travelCodeFilterInputEl) travelCodeFilterInputEl.value = ""; // Clear filter
        filterTravelCodeList(); // Apply (empty) filter

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
            const travelCodeHiddenInput = $("#adminServiceTravelCode"); // Hidden input to store the code
            if (travelCodeHiddenInput) travelCodeHiddenInput.value = code;
            const travelCodeDisplayInput = $("#adminServiceTravelCodeDisplay"); // Visible input for display
            if (travelCodeDisplayInput) travelCodeDisplayInput.value = `${desc} (${code})`;
            closeModal('travelCodeSelectionModal');
        } else {
            showMessage("Selection Error", "Please select a travel code from the list or cancel.");
        }
    });

    // Event listeners for custom time picker
    const timePickerBackBtn = $("#timePickerBackButton");
    if (timePickerBackBtn) timePickerBackBtn.addEventListener('click', ()=>{
        if(currentTimePickerStep==='minute'){
            selectedMinute=null; // Clear selection for this step
            $$('#timePickerMinutes button').forEach(b=>b.classList.remove('selected'));
            currentTimePickerStep='hour';
        } else if(currentTimePickerStep==='hour'){
            selectedHour12=null;
            $$('#timePickerHours button').forEach(b=>b.classList.remove('selected'));
            currentTimePickerStep='ampm';
        }
        updateTimePickerStepView(); // Go back to previous step view
    });

    const setTimeBtnEl = $("#setTimeButton");
    if (setTimeBtnEl) setTimeBtnEl.addEventListener('click', ()=>{
        if(activeTimeInput && selectedAmPm!=null && selectedHour12!=null && selectedMinute!=null){
            let hr24=parseInt(selectedHour12,10);
            if(selectedAmPm==="PM"&&hr24!==12)hr24+=12; // Convert 1-11 PM to 13-23
            if(selectedAmPm==="AM"&&hr24===12)hr24=0;  // Convert 12 AM to 00
            const timeString24 =`${String(hr24).padStart(2,'0')}:${String(selectedMinute).padStart(2,'0')}`;
            const timeString12 =`${String(selectedHour12).padStart(2,'0')}:${String(selectedMinute).padStart(2,'0')} ${selectedAmPm}`;
            activeTimeInput.value=timeString12;         // Display 12hr format
            activeTimeInput.dataset.value24=timeString24; // Store 24hr format in data attribute
            if(typeof timePickerCallback === 'function') timePickerCallback(timeString24); // Call callback if provided
        }
        closeModal('customTimePicker');
    });

    const cancelTimeBtnEl = $("#cancelTimeButton");
    if (cancelTimeBtnEl) cancelTimeBtnEl.addEventListener('click', ()=>closeModal('customTimePicker'));

    // Agreement PDF generation button
    const agreementPdfBtn = $("#pdfBtn"); // Assuming this is the PDF button on the agreement page
    if (agreementPdfBtn) agreementPdfBtn.addEventListener('click', () => {
        generateAgreementPdf(); // Ensure this function is defined and handles PDF generation
    });

    // Invite link setup
    const inviteLinkElement = $("#invite");
    if (inviteLinkElement) inviteLinkElement.textContent=`${location.origin}${location.pathname}#register`; // Simple registration link

    // File input for user setup wizard
    const wizardFilesInput = $("#wFiles");
    if (wizardFilesInput) wizardFilesInput.addEventListener('change', displayUploadedFilesWizard);

    // Shift Request Modal button
    const requestShiftBtn = $("#rqBtn"); // Button to open the request shift modal
    if (requestShiftBtn) requestShiftBtn.addEventListener('click', () => {
        const rqModalEl = $("#rqModal"); if (rqModalEl) rqModalEl.style.display = "flex";
        // Reset fields in request modal
        $("#rqDate").value = new Date().toISOString().split('T')[0]; // Default to today
        $("#rqStart").value = ""; $("#rqStart").dataset.value24 = "";
        $("#rqEnd").value = ""; $("#rqEnd").dataset.value24 = "";
        $("#rqReason").value = "";
    });

    // Log Shift Modal button (for adding to invoice)
    const logShiftBtn = $("#logTodayShiftBtn"); // Button to open log shift modal
    if (logShiftBtn) logShiftBtn.addEventListener('click', openLogShiftModal);

    // Signature Modal buttons
    const signAgreementBtn = $("#signBtn"); // Worker sign button
    if (signAgreementBtn) signAgreementBtn.addEventListener('click', async () => {
        signingAs = 'worker'; // Set context for who is signing
        const sigModalEl = $("#sigModal"); if (sigModalEl) sigModalEl.style.display = "flex";
        if(canvas && ctx) ctx.clearRect(0,0,canvas.width,canvas.height); // Clear previous signature
    });

    const participantSignBtnEl = $("#participantSignBtn"); // Participant sign button
    if (participantSignBtnEl) participantSignBtnEl.addEventListener('click', async () => {
        signingAs = 'participant';
        const sigModalEl = $("#sigModal"); if (sigModalEl) sigModalEl.style.display = "flex";
        if(canvas && ctx) ctx.clearRect(0,0,canvas.width,canvas.height);
    });

    // Signature Pad (Canvas) Setup
    canvas = $("#signatureCanvas"); // Ensure this ID matches your HTML
    if (canvas) {
        ctx = canvas.getContext("2d");
        if(ctx){
            ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
            // Pointer events for better touch compatibility
            canvas.onpointerdown=e=>{pen=true;ctx.beginPath();ctx.moveTo(e.offsetX,e.offsetY);};
            canvas.onpointermove=e=>{if(pen){ctx.lineTo(e.offsetX,e.offsetY);ctx.stroke();}};
            canvas.onpointerup=()=>{pen=false;ctx.closePath();}; // End path on pointer up
            canvas.onpointerleave=()=>pen=false; // Stop drawing if pointer leaves canvas
        } else {
            console.error("Could not get 2D context for signature canvas.");
        }
    } else {
        console.warn("Signature canvas element #signatureCanvas not found."); // Corrected ID
    }

    // Logout button
    const logoutButton = $("#logoutBtn");
    if (logoutButton) logoutButton.addEventListener('click', logout);

    // Save worker authorizations button (Admin panel)
    const saveAuthBtn = $("#saveWorkerAuthorizationsBtn");
    if (saveAuthBtn) saveAuthBtn.addEventListener('click', saveWorkerAuthorizationsToFirestore);

    // Hashchange listener for navigation
    window.addEventListener('hashchange', () => setActive(location.hash));

    // Initial page load: setActive will be called by onAuthStateChanged logic
    // or after Firebase initialization if no user.
    // No explicit setActive call here to avoid race conditions with auth state.
    
    console.log("[App] DOMContentLoaded processing complete.");
   // hideLoading(); // Moved to be called after auth state is resolved in setupAuthListener

});

// Helper function to add a clause editor to the admin agreement customization UI
function handleAddAgreementClause() {
    const clausesContainer = $("#adminAgreementClausesContainer");
    if (!clausesContainer) {
        showMessage("Error", "Clauses container not found in HTML.");
        return;
    }
    const newClauseIndex = clausesContainer.querySelectorAll('.agreement-clause-editor').length;
    const clauseDiv = document.createElement('div');
    clauseDiv.className = 'agreement-clause-editor'; // Class for styling
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
    // Add event listener to the new remove button
    clauseDiv.querySelector('.remove-clause-btn').addEventListener('click', function() {
        this.closest('.agreement-clause-editor').remove(); // Remove the parent div
        // Re-index remaining clauses for display and preview
        clausesContainer.querySelectorAll('.agreement-clause-editor').forEach((editor, idx) => {
            const headingLabel = editor.querySelector('label:first-of-type');
            if (headingLabel) headingLabel.textContent = `Heading (Clause ${idx + 1}):`;
            const removeBtn = editor.querySelector('.remove-clause-btn');
            if (removeBtn) removeBtn.dataset.index = idx; // Update index if needed for other logic
        });
        renderAdminAgreementPreview(); // Update preview after removal
    });
}

// Home Page Display Logic
function handleHomePageDisplay() {
    if (currentUserId) { // User is logged in
        const homeUserDiv = $("#homeUser");
        if (homeUserDiv) homeUserDiv.classList.remove('hide'); // Show user-specific content
        const userNameDisplaySpan = $("#userNameDisplay");
        if (userNameDisplaySpan) userNameDisplaySpan.textContent = profile.name || (currentUserEmail ? currentUserEmail.split('@')[0] : "User");

        // Load and display shift requests for the user (or all if admin)
        loadShiftRequestsForUserDisplay();

        // Potentially load other dashboard items here
    } else { // User is not logged in
        const homeUserDiv = $("#homeUser");
        if (homeUserDiv) homeUserDiv.classList.add('hide'); // Hide user-specific content
        // Display generic home content or login prompt if necessary
    }
}

async function loadShiftRequestsForUserDisplay() {
    const shiftRequestsContainer = $("#shiftRequestsContainer"); // Overall container for the list
    const rqTblBody = $("#rqTbl tbody"); // Table body to populate
    if (!shiftRequestsContainer || !rqTblBody || !currentUserId || !isFirebaseInitialized) return;

    showLoading("Loading shift requests...");
    rqTblBody.innerHTML = "<tr><td colspan='5'>Loading requests...</td></tr>"; // Placeholder

    try {
        let q;
        if (profile.isAdmin) { // Admin sees all requests
            q = query(collection(fsDb, `artifacts/${appId}/public/data/shiftRequests`));
        } else { // User sees only their own requests
            q = query(collection(fsDb, `artifacts/${appId}/public/data/shiftRequests`), where("userId", "==", currentUserId));
        }

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            rqTblBody.innerHTML = "<tr><td colspan='5'>No shift requests found.</td></tr>";
        } else {
            rqTblBody.innerHTML = ""; // Clear loading message
            querySnapshot.forEach(docSnap => {
                const req = docSnap.data();
                const tr = rqTblBody.insertRow();
                tr.insertCell().textContent = formatDateForInvoiceDisplay(req.date);
                tr.insertCell().textContent = formatTime12Hour(req.startTime);
                tr.insertCell().textContent = formatTime12Hour(req.endTime);
                tr.insertCell().textContent = req.reason || "N/A";

                const statusCell = tr.insertCell();
                statusCell.textContent = req.status.charAt(0).toUpperCase() + req.status.slice(1); // Capitalize status
                statusCell.className = `status-${req.status}`; // For styling based on status (e.g., .status-pending)
                // Add action buttons for admin if needed (e.g., approve/reject request)
            });
        }
        shiftRequestsContainer.classList.remove('hide'); // Show the container
    } catch (error) {
        console.error("Error loading shift requests:", error);
        logErrorToFirestore("loadShiftRequestsForUserDisplay", error.message, error);
        rqTblBody.innerHTML = "<tr><td colspan='5'>Error loading requests.</td></tr>";
        showMessage("Data Error", "Could not load shift requests: " + error.message);
    } finally {
        hideLoading();
    }
}


// Filter for travel code selection modal (Admin Services)
function filterTravelCodeList() {
    const filterInputElement = $("#travelCodeFilterInput");
    const filterText = filterInputElement ? filterInputElement.value.toLowerCase() : "";
    $$("#travelCodeListContainer li").forEach(li => {
        const itemText = li.textContent ? li.textContent.toLowerCase() : "";
        li.style.display = itemText.includes(filterText) ? "" : "none"; // Show if text matches filter
    });
}

// Display uploaded files in User Setup Wizard
function displayUploadedFilesWizard() {
    const fileInput = $("#wFiles"); // The file input element in the wizard
    const fileListDiv = $("#wFilesList"); // The div to display the list of selected files
    if (!fileInput || !fileListDiv) return;

    fileListDiv.innerHTML = ''; // Clear previous list
    if (fileInput.files.length > 0) {
        Array.from(fileInput.files).forEach(file => {
            const fileDiv = document.createElement('div');
            // Display file name and size
            fileDiv.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            fileListDiv.appendChild(fileDiv);
        });
    } else {
        fileListDiv.textContent = 'No files selected.';
    }
}

// Open and prepare the "Log Shift" modal (for adding to invoice)
function openLogShiftModal() {
    const logShiftModalEl = $("#logShiftModal");
    if (logShiftModalEl) {
        // Set default date to today
        const dateInput = $("#logShiftDate");
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        // Populate support type dropdown with authorized services (excluding travel)
        const supportTypeSelect = $("#logShiftSupportType");
        if (supportTypeSelect) {
            supportTypeSelect.innerHTML = "<option value=''>Loading services...</option>"; // Placeholder
            // Filter adminManagedServices for those authorized for the current user and not travel type
            const availableServices = adminManagedServices.filter(s =>
                profile.authorizedServiceCodes?.includes(s.code) && s.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM
            );

            if (profile && profile.authorizedServiceCodes && availableServices.length > 0) {
                supportTypeSelect.innerHTML = "<option value=''>-- Select Support Type --</option>";
                availableServices.forEach(service => {
                    const opt = document.createElement('option');
                    opt.value = service.code;
                    opt.textContent = `${service.description} (${service.code})`;
                    supportTypeSelect.appendChild(opt);
                });
            } else if (adminManagedServices.length === 0) {
                 supportTypeSelect.innerHTML = "<option value=''>No services defined by admin</option>";
            } else { // Services exist, but none are authorized or suitable
                 supportTypeSelect.innerHTML = "<option value=''>No suitable services authorized.</option>";
            }
        }

        // Reset time inputs and set up custom time picker
        const startTimeInput = $("#logShiftStartTime");
        if (startTimeInput) {
            startTimeInput.value = ""; // Clear display value
            startTimeInput.dataset.value24 = ""; // Clear stored 24hr value
            startTimeInput.onclick = () => openCustomTimePicker(startTimeInput, null); // Open picker on click
        }
        const endTimeInput = $("#logShiftEndTime");
        if (endTimeInput) {
            endTimeInput.value = "";
            endTimeInput.dataset.value24 = "";
            endTimeInput.onclick = () => openCustomTimePicker(endTimeInput, null);
        }

        // Travel claim toggle and odometer fields
        const claimTravelToggle = $("#logShiftClaimTravelToggle");
        if (claimTravelToggle) {
            claimTravelToggle.checked = false; // Default to not claiming travel
            // Remove old listener before adding new one to prevent duplicates
            claimTravelToggle.removeEventListener('change', handleLogShiftTravelToggle); 
            claimTravelToggle.addEventListener('change', handleLogShiftTravelToggle);
        }
        const kmFieldsContainer = $("#logShiftKmFieldsContainer"); if (kmFieldsContainer) kmFieldsContainer.classList.add('hide'); // Hide by default
        const startKmInput = $("#logShiftStartKm"); if (startKmInput) { startKmInput.value = ""; startKmInput.oninput = calculateLogShiftTravelKm; }
        const endKmInput = $("#logShiftEndKm"); if (endKmInput) { endKmInput.value = ""; endKmInput.oninput = calculateLogShiftTravelKm; }
        const calculatedKmSpan = $("#logShiftCalculatedKm"); if (calculatedKmSpan) calculatedKmSpan.textContent = "0.0 Km";

        logShiftModalEl.style.display = "flex"; // Show the modal
    } else {
        showMessage("Error", "Log shift modal element not found.");
    }
}

// Handle toggle for claiming travel in "Log Shift" modal
function handleLogShiftTravelToggle() { // 'this' refers to the checkbox
    const kmFieldsContainer = $("#logShiftKmFieldsContainer");
    if (this.checked) { // If "Claim Travel" is checked
        kmFieldsContainer.classList.remove('hide'); // Show odometer fields
    } else { // If unchecked
        kmFieldsContainer.classList.add('hide'); // Hide odometer fields
        // Optionally clear odometer fields
        $("#logShiftStartKm").value = "";
        $("#logShiftEndKm").value = "";
        $("#logShiftCalculatedKm").textContent = "0.0 Km";
    }
}
// Calculate travel Km from odometer readings in "Log Shift" modal
function calculateLogShiftTravelKm() {
    const startKm = parseFloat($("#logShiftStartKm")?.value) || 0;
    const endKm = parseFloat($("#logShiftEndKm")?.value) || 0;
    const calculatedKmSpan = $("#logShiftCalculatedKm");
    if (endKm > startKm) { // Ensure end is greater than start
        calculatedKmSpan.textContent = `${(endKm - startKm).toFixed(1)} Km`;
    } else {
        calculatedKmSpan.textContent = "0.0 Km"; // Or "Invalid" or handle error
    }
}


// Update visibility of rate fields in Admin Service Management based on category type
function updateRateFieldsVisibility(categoryType) {
    const container = $("#adminServiceRateFieldsContainer");
    if(!container) return;
    container.innerHTML = ""; // Clear previous rate fields

    if (categoryType === SERVICE_CATEGORY_TYPES.CORE_STANDARD || categoryType === SERVICE_CATEGORY_TYPES.CORE_HIGH_INTENSITY) {
        RATE_CATEGORIES.forEach(cat => { // Weekday, Evening, Night, Saturday, Sunday, Public
            const div = document.createElement('div');
            div.className = 'form-group';
            div.innerHTML = `<label for="adminServiceRate_${cat}">Rate - ${cat.charAt(0).toUpperCase() + cat.slice(1)} ($):</label><input type="number" id="adminServiceRate_${cat}" step="0.01" min="0" placeholder="e.g., 55.75">`;
            container.appendChild(div);
        });
    } else if (categoryType === SERVICE_CATEGORY_TYPES.CAPACITY_THERAPY_STD || categoryType === SERVICE_CATEGORY_TYPES.CAPACITY_SPECIALIST || categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
        // These typically have a single standard rate
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `<label for="adminServiceRate_standardRate">Standard Rate ($):</label><input type="number" id="adminServiceRate_standardRate" step="0.01" min="0" placeholder="e.g., 193.99">`;
        container.appendChild(div);
    } else if (categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) {
        // Travel per KM has a specific rate
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `<label for="adminServiceRate_perKmRate">Rate per KM ($):</label><input type="number" id="adminServiceRate_perKmRate" step="0.01" min="0" placeholder="e.g., 0.97">`;
        container.appendChild(div);
    }
    // If editing, pre-fill existing rates for the selected category
    const serviceIdBeingEdited = $("#adminServiceId")?.value;
    if (serviceIdBeingEdited) {
        const service = adminManagedServices.find(s => s.id === serviceIdBeingEdited);
        // Only prefill if the category type matches the one for which fields were just created
        if (service?.rates && service.categoryType === categoryType) { 
            Object.keys(service.rates).forEach(rateKey => {
                // The rateKey should match the suffix of the input field ID (e.g., 'weekday', 'standardRate', 'perKmRate')
                let fieldIdSuffix = rateKey; // e.g. if rates object has { weekday: X, evening: Y }
                const rateField = $(`#adminServiceRate_${fieldIdSuffix}`);
                if (rateField) rateField.value = service.rates[rateKey];
            });
        }
    }
}

// Render the table of NDIS services in Admin panel
function renderAdminServicesTable() {
    const tbody = $("#adminServicesTable tbody");
    if (!tbody) return;
    tbody.innerHTML = ""; // Clear existing rows
    if (adminManagedServices.length === 0) {
        const tr = tbody.insertRow();
        const td = tr.insertCell();
        td.colSpan = 6; // Adjust colspan based on number of columns
        td.textContent = "No NDIS services defined yet. Add services using the form above.";
        td.style.textAlign = "center";
        return;
    }

    adminManagedServices.forEach(s => {
        const tr = tbody.insertRow();
        tr.insertCell().textContent = s.code || "N/A";
        tr.insertCell().textContent = s.description || "N/A";
        tr.insertCell().textContent = s.categoryType ? s.categoryType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : "N/A"; // Format category type

        // Display a primary rate for quick view
        let primaryRateDisplay="N/A";
        if(s.rates){
            if(s.rates.weekday !== undefined) primaryRateDisplay=`$${parseFloat(s.rates.weekday).toFixed(2)}`;
            else if(s.rates.standardRate !== undefined) primaryRateDisplay=`$${parseFloat(s.rates.standardRate).toFixed(2)}`;
            else if(s.rates.perKmRate !== undefined) primaryRateDisplay=`$${parseFloat(s.rates.perKmRate).toFixed(2)}/km`;
        }
        tr.insertCell().textContent = primaryRateDisplay;
        tr.insertCell().textContent = s.travelCode || "None"; // Associated travel code

        const actionsCell = tr.insertCell();
        actionsCell.innerHTML=`<button onclick="editAdminService('${s.id}')" class="btn-secondary btn-small" title="Edit Service"><i class="fas fa-edit"></i></button> <button onclick="deleteAdminService('${s.id}')" class="btn-danger btn-small" title="Delete Service"><i class="fas fa-trash-alt"></i></button>`;
    });
}

// Edit an NDIS service (Admin panel)
window.editAdminService = function(serviceId) {
    const serviceToEdit = adminManagedServices.find(item => item.id === serviceId);
    if (!serviceToEdit) {
        showMessage("Error", "Service not found for editing.");
        return;
    }
    // Populate form fields with service data
    $("#adminServiceId").value = serviceToEdit.id; // Hidden field for ID
    $("#adminServiceCode").value = serviceToEdit.code;
    $("#adminServiceDescription").value = serviceToEdit.description;
    $("#adminServiceCategoryType").value = serviceToEdit.categoryType;

    updateRateFieldsVisibility(serviceToEdit.categoryType); // This will also pre-fill rates

    // Pre-fill associated travel code
    $("#adminServiceTravelCode").value = serviceToEdit.travelCode || "";
    const associatedTravelService = adminManagedServices.find(ts => ts.code === serviceToEdit.travelCode);
    $("#adminServiceTravelCodeDisplay").value = associatedTravelService ? `${associatedTravelService.description} (${associatedTravelService.code})` : "None selected";

    $("#adminServiceFormContainer h4").innerHTML = `<i class="fas fa-edit"></i> Edit Service: ${serviceToEdit.code}`;
    const serviceCodeInputEl = $("#adminServiceCode"); // Focus on code input for editing
    if (serviceCodeInputEl) serviceCodeInputEl.focus();
};

// Delete an NDIS service (Admin panel) - initial confirmation
window.deleteAdminService = async function(serviceId) {
    const service = adminManagedServices.find(s => s.id === serviceId);
    if (!service) { showMessage("Error", "Service not found for deletion."); return; }
    // Use custom modal for confirmation
    showMessage("Confirm Delete", 
        `Are you sure you want to delete the service "${service.description} (${service.code})"? This cannot be undone.<br><br>
         <div class='modal-actions' style='justify-content: center; margin-top: 15px;'>
           <button onclick='_confirmDeleteServiceFirestore("${serviceId}")' class='btn-danger'><i class="fas fa-trash-alt"></i> Yes, Delete</button>
           <button class='btn-secondary' onclick='closeModal("messageModal")'><i class="fas fa-times"></i> No, Cancel</button>
         </div>`);
};

// Actual deletion after confirmation
window._confirmDeleteServiceFirestore = async function(serviceId) {
    closeModal("messageModal"); // Close the confirmation modal
    showLoading("Deleting service...");
    const success = await deleteAdminServiceFromFirestore(serviceId);
    hideLoading();
    if (success) {
        renderAdminServicesTable(); // Refresh the services table
        clearAdminServiceForm();    // Clear the form if it was showing the deleted service
        showMessage("Success", "Service deleted successfully.");
    } 
    // Error message handled by deleteAdminServiceFromFirestore
};

// Save (add or update) an NDIS service (Admin panel)
window.saveAdminService = async function() {
    const serviceId = $("#adminServiceId")?.value; // Empty if adding, has ID if editing
    const serviceCode = $("#adminServiceCode")?.value.trim();
    const serviceDescription = $("#adminServiceDescription")?.value.trim();
    const serviceCategoryType = $("#adminServiceCategoryType")?.value;
    const serviceTravelCode = $("#adminServiceTravelCode")?.value.trim() || null; // Store null if empty

    const rates = {};
    let allRatesValid = true;
    let firstInvalidRateField = null;

    if (!serviceCode || !serviceDescription || !serviceCategoryType) {
        return showMessage("Validation Error", "Service Code, Description, and Category Type are required.");
    }

    // Collect rates based on category type
    if (serviceCategoryType === SERVICE_CATEGORY_TYPES.CORE_STANDARD || serviceCategoryType === SERVICE_CATEGORY_TYPES.CORE_HIGH_INTENSITY) {
        RATE_CATEGORIES.forEach(cat => {
            const input = $(`#adminServiceRate_${cat}`);
            if (input) {
                const valStr = input.value.trim();
                if (valStr === "") { rates[cat] = 0; } // Default to 0 if empty, or handle as error
                else { const val = parseFloat(valStr); if (isNaN(val) || val < 0) { if(allRatesValid) firstInvalidRateField = input; allRatesValid = false; rates[cat] = 0; /* or some error marker */ } else { rates[cat] = val; } }
            } else { allRatesValid = false; rates[cat] = 0;} // Should not happen if UI is correct
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
    // Additional validation: e.g., weekday rate must be > 0 for core services
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
        travelCode: serviceTravelCode, // Link to a travel service code if applicable
        isActiveInAgreement: true // Default, can be changed later if needed
    };

    showLoading(serviceId ? "Updating service..." : "Adding service...");
    const success = await saveAdminServiceToFirestore(servicePayload, serviceId || null);
    hideLoading();
    if (success) {
        renderAdminServicesTable(); // Refresh table
        clearAdminServiceForm();    // Clear form for next entry
        showMessage("Success", `Service ${serviceId ? 'updated' : 'added'} successfully.`);
    }
    // Error messages are handled by saveAdminServiceToFirestore
};


// Load Admin Portal Settings into the form
function loadAdminPortalSettings() {
    if (!(profile?.isAdmin) || !isFirebaseInitialized) return; // Guard clause

    // Populate Organization Details
    const orgNameInput = $("#adminEditOrgName"); if (orgNameInput) orgNameInput.value = globalSettings.organizationName || "";
    const orgAbnInput = $("#adminEditOrgAbn"); if (orgAbnInput) orgAbnInput.value = globalSettings.organizationAbn || "";
    const orgEmailInput = $("#adminEditOrgContactEmail"); if (orgEmailInput) orgEmailInput.value = globalSettings.organizationContactEmail || "";
    const orgPhoneInput = $("#adminEditOrgContactPhone"); if (orgPhoneInput) orgPhoneInput.value = globalSettings.organizationContactPhone || "";

    // Populate Participant & Plan Details
    const participantNameInput = $("#adminEditParticipantName"); if (participantNameInput) participantNameInput.value = globalSettings.participantName || "";
    const participantNdisNoInput = $("#adminEditParticipantNdisNo"); if (participantNdisNoInput) participantNdisNoInput.value = globalSettings.participantNdisNo || "";
    const planManagerNameInput = $("#adminEditPlanManagerName"); if (planManagerNameInput) planManagerNameInput.value = globalSettings.planManagerName || "";
    const planManagerEmailInput = $("#adminEditPlanManagerEmail"); if (planManagerEmailInput) planManagerEmailInput.value = globalSettings.planManagerEmail || "";
    const planManagerPhoneInput = $("#adminEditPlanManagerPhone"); if (planManagerPhoneInput) planManagerPhoneInput.value = globalSettings.planManagerPhone || "";
    const planEndDateInput = $("#adminEditPlanEndDate"); if (planEndDateInput) planEndDateInput.value = globalSettings.planEndDate || "";

    // Adjust UI based on portal type (Organization vs. Self-Managed Participant)
    const orgDetailsSection = $("#adminEditOrgDetailsSection"); // The div containing org fields
    const participantTitle = $("#adminEditParticipantTitle"); // Title for participant section
    const hrSeparator = $("#adminEditParticipantHr"); // HR separator

    if (globalSettings.portalType === 'participant') { // Self-managed
        if (orgDetailsSection) orgDetailsSection.classList.add('hide');
        if (hrSeparator) hrSeparator.classList.add('hide');
        if (participantTitle) participantTitle.innerHTML = `<i class="fas fa-child"></i> Your (Participant) & Plan Details`;
    } else { // Organization
        if (orgDetailsSection) orgDetailsSection.classList.remove('hide');
        if (hrSeparator) hrSeparator.classList.remove('hide');
        if (participantTitle) participantTitle.innerHTML = `<i class="fas fa-child"></i> Default Participant & Plan Details`;
    }
}

// Load Admin Agreement Customizations into the editor
function loadAdminAgreementCustomizations() {
    if (!isFirebaseInitialized) return;
    // Ensure agreementCustomData is initialized (should be by loadAgreementCustomizationsFromFirestore)
    if (typeof agreementCustomData !== 'object' || agreementCustomData === null) {
        agreementCustomData = { overallTitle: "NDIS Service Agreement (Default)", clauses: [] }; // Fallback
    }

    const overallTitleInput = $("#adminAgreementOverallTitle");
    if (overallTitleInput) overallTitleInput.value = agreementCustomData.overallTitle || "NDIS Service Agreement";

    const clausesContainer = $("#adminAgreementClausesContainer");
    if(!clausesContainer) return;
    clausesContainer.innerHTML = ""; // Clear existing clause editors

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
        // Add event listener to the new remove button
        clauseDiv.querySelector('.remove-clause-btn').addEventListener('click', function() {
            this.closest('.agreement-clause-editor').remove();
            // Re-index clauses after removal for display and preview
            clausesContainer.querySelectorAll('.agreement-clause-editor').forEach((editor, idx) => {
                const headingLabel = editor.querySelector('label:first-of-type');
                if (headingLabel) headingLabel.textContent = `Heading (Clause ${idx + 1}):`;
                const removeBtn = editor.querySelector('.remove-clause-btn');
                if (removeBtn) removeBtn.dataset.index = idx; // Update index if needed
            });
            renderAdminAgreementPreview(); // Update preview
        });
    });
    renderAdminAgreementPreview(); // Initial preview render
}

// Render a preview of the agreement based on current admin editor fields
function renderAdminAgreementPreview() {
    const previewBox = $("#adminAgreementPreview");
    if (!previewBox) return;

     // Ensure agreementCustomData is an object, even if just for previewing inputs
     if (typeof agreementCustomData !== 'object' || agreementCustomData === null) {
        agreementCustomData = { overallTitle: "Preview Unavailable", clauses: [] };
    }

    // Get title from input if available, else from loaded data
    const overallTitleFromInput = $("#adminAgreementOverallTitle")?.value.trim() || agreementCustomData.overallTitle || "Service Agreement Preview";
    previewBox.innerHTML = `<h2>${overallTitleFromInput}</h2>`; // Start with the main title

    const clausesContainer = $("#adminAgreementClausesContainer");
    // If there are clause editors in the DOM, use their current values for the preview
    if (clausesContainer && clausesContainer.querySelectorAll('.agreement-clause-editor').length > 0) {
        clausesContainer.querySelectorAll('.agreement-clause-editor').forEach(clauseDiv => {
            const heading = clauseDiv.querySelector('.clause-heading-input')?.value.trim();
            const body = clauseDiv.querySelector('.clause-body-textarea')?.value.trim();
            if (heading) previewBox.innerHTML += `<h4>${heading}</h4>`;
            if (body) previewBox.innerHTML += `<div>${body.replace(/\n/g, '<br>')}</div>`; // Replace newlines with <br> for HTML display
        });
    } else if (!(agreementCustomData.clauses || []).length) { // No editors and no loaded clauses
        previewBox.innerHTML = "<p><em>No clauses defined. Add clauses above and save to see a preview.</em></p>";
    } else { // No editors, but clauses were loaded from Firestore (e.g., initial load)
         (agreementCustomData.clauses || []).forEach(c => {
            if(c.heading) previewBox.innerHTML += `<h4>${c.heading}</h4>`;
            if(c.body) previewBox.innerHTML += `<div>${(c.body || "").replace(/\n/g, '<br>')}</div>`;
        });
    }
}

// Populate worker selector dropdown in Admin Agreement Management
function populateAdminWorkerSelectorForAgreement() {
    const selector = $("#adminSelectWorkerForAgreement");
    if (!selector) return;
    selector.innerHTML = '<option value="">-- Select a Support Worker --</option>'; // Default option
    Object.entries(accounts).forEach(([key, acc]) => { // Iterate through loaded accounts
        if (acc && acc.profile && !acc.profile.isAdmin) { // Only non-admin users
            const workerProfile = acc.profile;
            const displayIdentifier = workerProfile.email || key; // Use email or UID as identifier
            const opt = document.createElement('option');
            opt.value = key; // Store the key (email or UID)
            opt.textContent = `${workerProfile.name || 'Unnamed Worker'} (${displayIdentifier})`;
            selector.appendChild(opt);
        }
    });
}

// Load service agreement for the worker selected by admin
window.loadServiceAgreementForSelectedWorker = function() {
    const selectedKey = $("#adminSelectWorkerForAgreement")?.value; // Get selected worker's key
    if (selectedKey) {
        currentAgreementWorkerEmail = selectedKey; // Set context for which worker's agreement to load
        loadServiceAgreement(); // Load the agreement
    } else { // No worker selected
        const agreementContainer = $("#agreementContentContainer");
        if (agreementContainer) agreementContainer.innerHTML = "<p><em>Please select a worker to load their service agreement.</em></p>";
        const agrChipEl = $("#agrChip"); if (agrChipEl) { agrChipEl.className = "chip yellow"; agrChipEl.textContent = "Select Worker"; }
        // Hide buttons if no worker is selected
    }
};

// Load and display a service agreement (for user or admin-selected worker)
async function loadServiceAgreement() {
    if (!currentUserId || !isFirebaseInitialized) {
        $("#agreementContentContainer").innerHTML = "<p><em>Error: User not logged in or Firebase not ready.</em></p>";
        return;
    }
    // Ensure agreement template is loaded
    if (typeof agreementCustomData !== 'object' || agreementCustomData === null || !agreementCustomData.clauses) {
        await loadAgreementCustomizationsFromFirestore(); // Attempt to load it
        if (typeof agreementCustomData !== 'object' || agreementCustomData === null || !agreementCustomData.clauses) {
            $("#agreementContentContainer").innerHTML = "<p><em>Error: Agreement template data is missing and could not be loaded. Please configure it in the admin panel.</em></p>";
            return;
        }
    }


    let workerProfileToUse; // The profile of the worker whose agreement is being displayed
    let workerName, workerAbn;
    let agreementDocPath; // Firestore path to the specific agreement instance

    if (profile.isAdmin && currentAgreementWorkerEmail) { // Admin viewing a selected worker's agreement
        workerProfileToUse = accounts[currentAgreementWorkerEmail]?.profile;
        if (!workerProfileToUse) {
            $("#agreementContentContainer").innerHTML = "<p><em>Error: Selected worker profile not found.</em></p>";
            return;
        }
        workerName = workerProfileToUse.name;
        workerAbn = workerProfileToUse.abn;
        $("#agreementDynamicTitle").innerHTML = `<i class="fas fa-handshake"></i> Service Agreement for ${workerName}`;
        agreementDocPath = `artifacts/${appId}/users/${workerProfileToUse.uid}/agreements/main`;
    } else if (!profile.isAdmin && currentUserId) { // User viewing their own agreement
        workerProfileToUse = profile;
        workerName = profile.name;
        workerAbn = profile.abn;
        $("#agreementDynamicTitle").innerHTML = `<i class="fas fa-handshake"></i> Your Service Agreement`;
        agreementDocPath = `artifacts/${appId}/users/${currentUserId}/agreements/main`;
    } else { // Should not happen if UI logic is correct
        $("#agreementContentContainer").innerHTML = "<p><em>Cannot determine whose agreement to load.</em></p>";
        return;
    }

    const agreementContainer = $("#agreementContentContainer");
    if (!agreementContainer) return;

    // Load existing agreement instance data (signatures, dates)
    let agreementInstanceData = { workerSigned: false, participantSigned: false, workerSigUrl: null, participantSigUrl: null, workerSignDate: null, participantSignDate: null, agreementStartDate: globalSettings.agreementStartDate };
    try {
        const agreementInstanceRef = doc(fsDb, agreementDocPath);
        const agreementInstanceSnap = await getDoc(agreementInstanceRef);
        if (agreementInstanceSnap.exists()) {
            agreementInstanceData = { ...agreementInstanceData, ...agreementInstanceSnap.data() };
        } else { // If no instance exists, create one with default start date
            await setDoc(agreementInstanceRef, {
                agreementStartDate: globalSettings.agreementStartDate || new Date().toISOString().split('T')[0],
                lastUpdated: serverTimestamp(),
                updatedBy: currentUserId, // User creating/viewing it
                createdAt: serverTimestamp(),
                createdBy: currentUserId
            });
            // agreementInstanceData will use the defaults set above
        }
    } catch (e) {
        console.warn("Could not load or create agreement instance data:", e);
        logErrorToFirestore("loadServiceAgreement_getInstance", e.message, e);
        // Proceed with default instance data
    }

    // --- Render Agreement Content ---
    let content = `<h2>${agreementCustomData.overallTitle || "Service Agreement"}</h2>`;
    (agreementCustomData.clauses || []).forEach(clause => {
        let clauseBody = clause.body || "";
        // Replace placeholders
        clauseBody = clauseBody.replace(/{{participantName}}/g, globalSettings.participantName || "[Participant Name]")
                               .replace(/{{participantNdisNo}}/g, globalSettings.participantNdisNo || "[NDIS No]")
                               .replace(/{{workerName}}/g, workerName || "[Worker Name]")
                               .replace(/{{workerAbn}}/g, workerAbn || "[Worker ABN]")
                               .replace(/{{agreementStartDate}}/g, formatDateForInvoiceDisplay(agreementInstanceData.agreementStartDate || globalSettings.agreementStartDate || new Date()))
                               .replace(/{{agreementEndDate}}/g, formatDateForInvoiceDisplay(globalSettings.planEndDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)))); // Default end date

        // Replace {{serviceList}} placeholder
        let serviceListHtml = "<ul>";
        const authorizedCodes = workerProfileToUse.authorizedServiceCodes || [];
        if (authorizedCodes.length > 0) {
            authorizedCodes.forEach(code => {
                const serviceDetail = adminManagedServices.find(s => s.code === code);
                serviceListHtml += `<li>${serviceDetail ? serviceDetail.description : code}</li>`;
            });
        } else {
            serviceListHtml += "<li>No specific services listed/authorized. General support will be provided as agreed.</li>";
        }
        serviceListHtml += "</ul>";
        clauseBody = clauseBody.replace(/{{serviceList}}/g, serviceListHtml);

        content += `<h4>${clause.heading || ""}</h4><div>${clauseBody.replace(/\n/g, '<br>')}</div>`;
    });
    agreementContainer.innerHTML = content;

    // --- Update Signature Display and Button Visibility ---
    const sigPImg = $("#sigP"); const dPEl = $("#dP"); // Participant signature elements
    const sigWImg = $("#sigW"); const dWEl = $("#dW"); // Worker signature elements

    if (agreementInstanceData.participantSigUrl && sigPImg) sigPImg.src = agreementInstanceData.participantSigUrl; else if (sigPImg) sigPImg.src = ""; // Clear if no URL
    if (agreementInstanceData.participantSignDate && dPEl) dPEl.textContent = formatDateForInvoiceDisplay(agreementInstanceData.participantSignDate.toDate ? agreementInstanceData.participantSignDate.toDate() : agreementInstanceData.participantSignDate); else if (dPEl) dPEl.textContent = "___";

    if (agreementInstanceData.workerSigUrl && sigWImg) sigWImg.src = agreementInstanceData.workerSigUrl; else if (sigWImg) sigWImg.src = "";
    if (agreementInstanceData.workerSignDate && dWEl) dWEl.textContent = formatDateForInvoiceDisplay(agreementInstanceData.workerSignDate.toDate ? agreementInstanceData.workerSignDate.toDate() : agreementInstanceData.workerSignDate); else if (dWEl) dWEl.textContent = "___";

    // Update status chip and button visibility
    const agrChipEl = $("#agrChip");
    const signBtnEl = $("#signBtn"); // Worker sign button
    const participantSignBtnEl = $("#participantSignBtn"); // Participant sign button (can be admin or participant)
    const pdfBtnEl = $("#pdfBtn");

    if (agreementInstanceData.workerSigned && agreementInstanceData.participantSigned) {
        if (agrChipEl) { agrChipEl.className = "chip green"; agrChipEl.textContent = "Signed & Active"; }
        if (signBtnEl) signBtnEl.classList.add("hide");
        if (participantSignBtnEl) participantSignBtnEl.classList.add("hide");
    } else if (agreementInstanceData.workerSigned) { // Worker signed, awaiting participant
        if (agrChipEl) { agrChipEl.className = "chip yellow"; agrChipEl.textContent = "Worker Signed - Awaiting Participant"; }
        if (signBtnEl) signBtnEl.classList.add("hide"); // Worker already signed
        if (participantSignBtnEl) participantSignBtnEl.classList.remove("hide"); // Participant can sign
    } else if (agreementInstanceData.participantSigned) { // Participant signed, awaiting worker
        if (agrChipEl) { agrChipEl.className = "chip yellow"; agrChipEl.textContent = "Participant Signed - Awaiting Worker"; }
        if (signBtnEl) signBtnEl.classList.remove("hide"); // Worker can sign
        if (participantSignBtnEl) participantSignBtnEl.classList.add("hide"); // Participant already signed
    } else { // No one signed yet
        if (agrChipEl) { agrChipEl.className = "chip yellow"; agrChipEl.textContent = "Draft - Awaiting Signatures"; }
        if (signBtnEl) signBtnEl.classList.remove("hide");
        if (participantSignBtnEl) participantSignBtnEl.classList.remove("hide");
    }

    if (pdfBtnEl) pdfBtnEl.classList.remove("hide"); // PDF always available once loaded

    // Specific button logic for admin vs. user
    if (profile.isAdmin) { // Admin is viewing
        // Admin generally doesn't sign directly from this view unless proxying, which is complex.
        // For simplicity, admin view might not show signing buttons, or they'd have different logic.
        // For now, hide signing buttons if admin is viewing another's agreement.
        if (signBtnEl) signBtnEl.classList.add("hide");
        if (participantSignBtnEl) participantSignBtnEl.classList.add("hide"); // Or enable if admin can sign for participant
    } else { // User is viewing their own agreement
        if (currentUserId === workerProfileToUse.uid) { // Current user is the worker
            if (agreementInstanceData.workerSigned && signBtnEl) signBtnEl.classList.add("hide"); else if (signBtnEl) signBtnEl.classList.remove("hide");
            // User (worker) cannot sign as participant from their view
            if (participantSignBtnEl) participantSignBtnEl.classList.add("hide"); 
        } else { // Should not happen if logic is correct (user only sees their own)
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
    let workerName = profile.name ?? "Worker Name N/A";
    let workerAbn = profile.abn ?? "Worker ABN N/A";

    // If admin is viewing a specific worker's agreement for PDF
    if (profile.isAdmin && currentAgreementWorkerEmail) {
        const selectedWorker = accounts[currentAgreementWorkerEmail]?.profile;
        if (selectedWorker) {
            workerProfileToUse = selectedWorker;
            workerName = selectedWorker.name ?? "Worker Name N/A";
            workerAbn = selectedWorker.abn ?? "Worker ABN N/A";
        } else {
            showMessage("Error", "Selected worker profile for PDF not found.");
            return;
        }
    }

    // Fetch the latest agreement instance data for signatures and dates
    let agreementInstanceData = {
        workerSigUrl: $("#sigW")?.src, // Fallback to current UI if Firestore fetch fails
        participantSigUrl: $("#sigP")?.src,
        workerSignDate: $("#dW")?.textContent,
        participantSignDate: $("#dP")?.textContent,
        agreementStartDate: globalSettings.agreementStartDate // Default start date
    };
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
    } catch(e) {
        console.warn("Could not fetch latest agreement instance for PDF:", e);
        logErrorToFirestore("generateAgreementPdf_fetchInstance", e.message, e);
        // Proceed with UI data as fallback
    }


    // HTML content for the PDF
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
                 <h1>${globalSettings.organizationName ?? 'Service Provider'}</h1> <h2>${agreementCustomData.overallTitle ?? "Service Agreement"}</h2>
            </div>`;

    (agreementCustomData.clauses || []).forEach(clause => {
        let clauseBody = clause.body || "";
        // Replace placeholders
        clauseBody = clauseBody.replace(/{{participantName}}/g, globalSettings.participantName ?? "[Participant Name]")
                               .replace(/{{participantNdisNo}}/g, globalSettings.participantNdisNo ?? "[NDIS No]")
                               .replace(/{{workerName}}/g, workerName ?? "[Worker Name]") // Use specific worker's name
                               .replace(/{{workerAbn}}/g, workerAbn ?? "[Worker ABN]")   // Use specific worker's ABN
                               .replace(/{{agreementStartDate}}/g, formatDateForInvoiceDisplay(agreementInstanceData.agreementStartDate || globalSettings.agreementStartDate || new Date()))
                               .replace(/{{agreementEndDate}}/g, formatDateForInvoiceDisplay(globalSettings.planEndDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1))));

        let serviceListHtml = "<ul>";
        const authorizedCodes = workerProfileToUse.authorizedServiceCodes || []; // Use specific worker's authorized codes
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

    // Add signature section
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
    tempDivAgreement.style.position = "absolute";
    tempDivAgreement.style.left = "-9999px";
    tempDivAgreement.style.width = "210mm"; // A4 width
    tempDivAgreement.innerHTML = pdfHtml;
    document.body.appendChild(tempDivAgreement);

    // Sanitize names for PDF filename
    const sanitizedWorkerName = sanitizeFilename(workerName);
    const sanitizedParticipantNameAgreement = sanitizeFilename(globalSettings.participantName);
    const sanitizedAgreementStartDate = sanitizeFilename(formatDateForInvoiceDisplay(agreementInstanceData.agreementStartDate || globalSettings.agreementStartDate || new Date()));
    const sanitizedPlanEndDate = sanitizeFilename(formatDateForInvoiceDisplay(globalSettings.planEndDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)))); // Ensure valid date before formatting
    const agreementPdfFilename = `[agreement]_worker_${sanitizedWorkerName}_participant_${sanitizedParticipantNameAgreement}_start_${sanitizedAgreementStartDate}_end_${sanitizedPlanEndDate}.pdf`;


    const opt = {
        margin: [15, 15, 15, 15], // mm [top, left, bottom, right]
        filename: agreementPdfFilename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: -window.scrollY },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(tempDivAgreement).set(opt).save().then(() => {
        showMessage("PDF Generated", "Service Agreement PDF has been downloaded.");
        tempDivAgreement.remove(); // Clean up
    }).catch(err => {
        console.error("Error generating agreement PDF:", err);
        logErrorToFirestore("generateAgreementPdf", err.message, err);
        showMessage("PDF Error", "Could not generate PDF: " + err.message);
        tempDivAgreement.remove();
    });
}


// Load user profile data into the Profile page
function loadProfileData() {
    if (!profile || !isFirebaseInitialized) return; // Ensure profile and Firebase are ready
    const profileNameEl = $("#profileName"); if (profileNameEl) profileNameEl.textContent = profile.name || "N/A";
    const profileAbnEl = $("#profileAbn"); if (profileAbnEl) profileAbnEl.textContent = profile.abn || "N/A";
    const profileGstEl = $("#profileGst"); if (profileGstEl) profileGstEl.textContent = profile.gstRegistered ? "Yes" : "No";
    const profileBsbEl = $("#profileBsb"); if (profileBsbEl) profileBsbEl.textContent = profile.bsb || "N/A";
    const profileAccEl = $("#profileAcc"); if (profileAccEl) profileAccEl.textContent = profile.acc || "N/A";

    // Display uploaded files
    const filesListUl = $("#profileFilesList");
    if (filesListUl) {
        if (profile.files && profile.files.length > 0) {
            filesListUl.innerHTML = ""; // Clear previous list
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
// Delete a document from user's profile (confirmation step)
window.deleteProfileDocument = async function(fileName, storagePath) {
    if (!currentUserId || !fsDb) {
        showMessage("Error", "User not logged in or database not ready.");
        return;
    }
    if (!fileName) { // storagePath might be empty for older files not having it
        showMessage("Error", "File name not provided for deletion.");
        return;
    }

    // Use custom modal for confirmation
    showMessage("Confirm Delete", 
        `Are you sure you want to delete the document "${fileName}"? This action cannot be undone.<br><br>
         <div class='modal-actions' style='justify-content: center; margin-top: 15px;'>
           <button onclick='_confirmDeleteProfileDocument("${fileName}", "${storagePath}")' class='btn-danger'><i class="fas fa-trash-alt"></i> Yes, Delete</button>
           <button class='btn-secondary' onclick='closeModal("messageModal")'><i class="fas fa-times"></i> No, Cancel</button>
         </div>`);
};

// Actual deletion after confirmation
window._confirmDeleteProfileDocument = async function(fileName, storagePath) {
    closeModal("messageModal"); // Close confirmation
    showLoading("Deleting document...");

    // 1. Delete from Firebase Storage if storagePath is available
    if (storagePath && fbStorage) {
        const fileRef = ref(fbStorage, storagePath);
        try {
            await deleteObject(fileRef);
            console.log(`File deleted from Storage: ${storagePath}`);
        } catch (storageError) {
            console.error("Error deleting file from Storage:", storageError);
            logErrorToFirestore("_confirmDeleteProfileDocument_storageDelete", storageError.message, {fileName, storagePath, storageError});
            // Don't stop here; still try to remove metadata. User might see a broken link if metadata remains.
            showMessage("Storage Warning", "Could not delete file from cloud storage, but will attempt to remove metadata.");
        }
    } else {
        console.warn("Storage path not provided or Storage not initialized. Skipping cloud deletion for:", fileName);
    }

    // 2. Remove metadata from Firestore profile.files array
    try {
        const userProfileDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/profile`, "details");
        // Find the exact file object to remove. Match by storagePath if available, else by name.
        const fileToRemove = profile.files.find(f => (f.storagePath && f.storagePath === storagePath) || (!f.storagePath && f.name === fileName) );

        if (fileToRemove) {
            await updateDoc(userProfileDocRef, {
                files: arrayRemove(fileToRemove), // Atomically remove the file object
                lastUpdated: serverTimestamp(),
                updatedBy: currentUserId
            });
            // Update local profile cache
            profile.files = profile.files.filter(f => !((f.storagePath && f.storagePath === storagePath) || (!f.storagePath && f.name === fileName)));
        } else {
            console.warn("File metadata not found in profile for deletion:", fileName, storagePath);
            // This might happen if deletion was attempted twice or data is inconsistent.
        }

        loadProfileData(); // Refresh the displayed file list
        showMessage("Document Update", `Document "${fileName}" metadata processed.`);
    } catch (error) {
        console.error("Error deleting document metadata from Firestore:", error);
        logErrorToFirestore("_confirmDeleteProfileDocument_firestoreDelete", error.message, {fileName, error});
        showMessage("Error", "Could not delete document metadata: " + error.message);
    } finally {
        hideLoading();
    }
};


// Logic to enter the portal after login/setup
function enterPortal(isAdmin) {
    if (isAdmin) {
        // Admin default page or last visited admin page
        setActive(location.hash || "#admin"); // Default to admin panel
    } else { // Regular user
        // Check if user setup is complete if it's an organization portal
        if (globalSettings.portalType === 'organization' && (!profile.abn || !profile.bsb || !profile.acc || !profile.profileSetupComplete )) {
            openUserSetupWizard(); // Force setup if not complete
            return; // Don't proceed to portal yet
        }
        // User default page (e.g., home, dashboard)
        setActive(location.hash || "#home");
    }

    // Common UI updates after entering portal
    const homeUserDiv = $("#homeUser"); if (homeUserDiv) homeUserDiv.classList.remove('hide'); // Show user-specific home content
    const userNameDisplaySpan = $("#userNameDisplay"); 
    if (userNameDisplaySpan) userNameDisplaySpan.textContent = profile.name || (currentUserEmail ? currentUserEmail.split('@')[0] : "User");
}

// Format invoice number (e.g., INV-001001)
function formatInvoiceNumber(num) {
    return `INV-${String(num).padStart(6, '0')}`;
}

// Load data and set up UI for the Invoice page
async function handleInvoicePageLoad() {
    const wkLblEl = $("#wkLbl"); if (wkLblEl) wkLblEl.textContent = new Date().getWeek(); // Display current week number
    const invNoInput = $("#invNo"); // Invoice number input
    const invDateInput = $("#invDate"); if (invDateInput) invDateInput.value = new Date().toISOString().split('T')[0]; // Default to today

    // Populate provider details from profile or global settings (if applicable)
    const provNameInput = $("#provName"); 
    if (provNameInput) provNameInput.value = profile.name || (globalSettings.portalType === 'organization' ? globalSettings.organizationName : "") || "";
    
    const provAbnInput = $("#provAbn"); 
    if (provAbnInput) provAbnInput.value = profile.abn || (globalSettings.portalType === 'organization' ? globalSettings.organizationAbn : "") || "";

    // GST flag and display
    const gstFlagInput = $("#gstFlag");
    const isGstRegistered = profile.gstRegistered !== undefined ? profile.gstRegistered : false;
    if (gstFlagInput) gstFlagInput.value = isGstRegistered ? "Yes" : "No";
    
    const gstRowDiv = $("#gstRow"); // The div containing GST amount
    if (gstRowDiv) gstRowDiv.style.display = isGstRegistered ? "flex" : "none"; // Show/hide based on GST registration

    // Handle next invoice number
    if (!profile.nextInvoiceNumber && invNoInput) { // If no next invoice number is set (first time)
        const setInitialModal = $("#setInitialInvoiceModal");
        if (setInitialModal) {
            setInitialModal.style.display = "flex"; // Show modal to set initial number
            $("#initialInvoiceNumberInput").value = 1001; // Default suggestion
        }
        invNoInput.value = ""; // Clear invoice number field until set
    } else if (invNoInput) { // If next invoice number is set
        invNoInput.value = formatInvoiceNumber(profile.nextInvoiceNumber);
    }

    await loadDraftInvoice(); // Load any existing draft for this invoice number
}

async function loadDraftInvoice() {
    const invTblBody = $("#invTbl tbody");
    if (!invTblBody || !currentUserId || !isFirebaseInitialized) {
        if (invTblBody) invTblBody.innerHTML = "<tr><td colspan='12' style='text-align:center;'>Error loading invoice data.</td></tr>";
        return;
    }

    showLoading("Loading invoice draft...");
    try {
        // Determine draft ID: use nextInvoiceNumber or 'current' as a fallback
        const draftInvoiceNumber = profile.nextInvoiceNumber ? formatInvoiceNumber(profile.nextInvoiceNumber) : 'current';
        const draftDocRef = doc(fsDb, `artifacts/${appId}/users/${currentUserId}/invoices`, `draft-${draftInvoiceNumber}`);
        const docSnap = await getDoc(draftDocRef);

        if (docSnap.exists()) {
            currentInvoiceData = docSnap.data();
            // Populate form fields from draft
            $("#invNo").value = currentInvoiceData.invoiceNumber || draftInvoiceNumber;
            $("#invDate").value = currentInvoiceData.invoiceDate || new Date().toISOString().split('T')[0];
            // Provider name, ABN, GST flag are usually from profile, but draft could override if designed so.
            // For now, assume they are set by handleInvoicePageLoad from profile.

            invTblBody.innerHTML = ""; // Clear table
            if (currentInvoiceData.items && currentInvoiceData.items.length > 0) {
                currentInvoiceData.items.forEach(item => addInvoiceRow(item, true)); // Add rows from draft
            } else {
                addInvoiceRow(); // Add a blank row if draft is empty
            }
        } else { // No draft found
            currentInvoiceData = { items: [], invoiceNumber: draftInvoiceNumber, invoiceDate: new Date().toISOString().split('T')[0], subtotal: 0, gst: 0, grandTotal: 0 };
            invTblBody.innerHTML = "";
            addInvoiceRow(); // Add a blank row
        }
    } catch (error) {
        console.error("Error loading invoice draft:", error);
        logErrorToFirestore("loadDraftInvoice", error.message, error);
        invTblBody.innerHTML = "<tr><td colspan='12' style='text-align:center;'>Could not load invoice draft.</td></tr>";
        // Fallback to a new invoice state
        currentInvoiceData = { items: [], invoiceNumber: profile.nextInvoiceNumber ? formatInvoiceNumber(profile.nextInvoiceNumber) : 'current', invoiceDate: new Date().toISOString().split('T')[0], subtotal: 0, gst: 0, grandTotal: 0 };
        addInvoiceRow();
    } finally {
        calculateInvoiceTotals(); // Calculate totals after loading/initializing
        hideLoading();
    }
}


// Get week number (utility)
Date.prototype.getWeek = function() {
  var date = new Date(this.getTime());
   date.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year.
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  // January 4 is always in week 1.
  var week1 = new Date(date.getFullYear(), 0, 4);
  // Adjust to Thursday in week 1 and count number of weeks from date to week1.
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}


// Custom Time Picker Logic
function openCustomTimePicker(inputElement, callbackFn) {
    activeTimeInput = inputElement; // Store the input field being edited
    timePickerCallback = callbackFn; // Store callback to execute after time is set
    const picker = $("#customTimePicker");
    if (picker) {
        picker.classList.remove('hide');
        picker.style.display = 'flex'; // Show the picker
        // Reset selections
        selectedAmPm = null;
        selectedHour12 = null;
        selectedMinute = null;
        $$('#timePickerAmPmButtons button, #timePickerHours button, #timePickerMinutes button').forEach(b => b.classList.remove('selected'));
        currentTimePickerStep = 'ampm'; // Start with AM/PM selection
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

    // Hide all step divs and back button initially
    if (ampmStepDiv) ampmStepDiv.classList.add('hide');
    if (hourStepDiv) hourStepDiv.classList.add('hide');
    if (minuteStepDiv) minuteStepDiv.classList.add('hide');
    if (backButton) backButton.classList.add('hide');

    if (currentTimePickerStep === 'ampm') {
        if (stepLabel) stepLabel.textContent = "Select AM or PM";
        if (ampmStepDiv) {
            ampmStepDiv.classList.remove('hide'); // Show AM/PM selection
            const ampmButtonsContainer = $("#timePickerAmPmButtons");
            if (ampmButtonsContainer) { // Dynamically create AM/PM buttons
                ampmButtonsContainer.innerHTML = ''; // Clear previous
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
            hourStepDiv.classList.remove('hide'); // Show hour selection
            const hoursContainer = $("#timePickerHours");
            if (hoursContainer) { // Dynamically create hour buttons
                hoursContainer.innerHTML = '';
                for (let i = 1; i <= 12; i++) {
                    const btn = document.createElement('button'); btn.textContent = i;
                    btn.onclick = () => { selectedHour12 = String(i).padStart(2,'0'); currentTimePickerStep = 'minute'; updateTimePickerStepView(); };
                    if (selectedHour12 === String(i).padStart(2,'0')) btn.classList.add('selected');
                    hoursContainer.appendChild(btn);
                }
            }
        }
        if (backButton) backButton.classList.remove('hide'); // Show back button
    } else if (currentTimePickerStep === 'minute') {
        if (stepLabel) stepLabel.textContent = `Selected: ${selectedHour12 || ''} ${selectedAmPm || ''} - Select Minute`;
        if (minuteStepDiv) {
            minuteStepDiv.classList.remove('hide'); // Show minute selection
            const minutesContainer = $("#timePickerMinutes");
            if (minutesContainer) { // Dynamically create minute buttons (00, 15, 30, 45)
                minutesContainer.innerHTML = '';
                ['00', '15', '30', '45'].forEach(val => {
                    const btn = document.createElement('button'); btn.textContent = val;
                    btn.onclick = () => { selectedMinute = val; updateTimePickerStepView(); /* Update view to enable Set button */ };
                    if (selectedMinute === val) btn.classList.add('selected');
                    minutesContainer.appendChild(btn);
                });
            }
        }
        if (backButton) backButton.classList.remove('hide'); // Show back button
    }
    // Enable/disable Set button based on selection completion
    if (setButton) setButton.disabled = !(selectedAmPm && selectedHour12 && selectedMinute);
}

// Logout Function
async function logout() {
  if (!isFirebaseInitialized || !fbAuth) {
      // This case should ideally not happen if app structure is correct
      showAuthStatusMessage("Logout Error: Authentication service not available.");
      if(authScreenElement) authScreenElement.style.display = "flex"; // Show auth screen as fallback
      if(portalAppElement) portalAppElement.style.display = "none";
      return;
  }
  try {
    showLoading("Logging out...");
    await fbSignOut(fbAuth);
    // onAuthStateChanged will handle UI reset (showing auth screen, clearing profile, etc.)
  } catch (e) {
    console.error("Logout failed:", e);
    logErrorToFirestore("logout", e.message, e);
    showAuthStatusMessage("Logout Error: " + e.message); // Show error on auth screen
  } finally {
      hideLoading();
  }
}

// Admin: Save Portal Settings (from Admin Panel)
window.saveAdminPortalSettings = async function() {
    if (!isFirebaseInitialized || !(profile?.isAdmin)) {
        showMessage("Permission Denied", "You do not have permission to save portal settings.");
        return;
    }

    // Get portal type from radio button (if it's part of this form, otherwise from globalSettings)
    // Assuming portal type is fixed once set by wizard, or there's a separate control for it.
    // For this function, we'll assume globalSettings.portalType is the source of truth for type.
    const currentPortalType = globalSettings.portalType; 
    let orgNameVal = $("#adminEditOrgName")?.value.trim();
    let orgAbnVal = $("#adminEditOrgAbn")?.value.trim().replace(/\D/g, ''); // Sanitize ABN
    let orgEmailVal = $("#adminEditOrgContactEmail")?.value.trim();
    let planManagerEmailVal = $("#adminEditPlanManagerEmail")?.value.trim();

    // Update input with sanitized ABN for user feedback
    if ($("#adminEditOrgAbn")) $("#adminEditOrgAbn").value = orgAbnVal;

    // Validations
    if (currentPortalType === "organization") { // Stricter for organization type
        if (!orgNameVal) { return showMessage("Validation Error", "Organization Name is required.");}
        if (orgAbnVal && !isValidABN(orgAbnVal)) { return showMessage("Validation Error", "Invalid Organization ABN. Please enter an 11-digit ABN.");}
        if (orgEmailVal && !validateEmail(orgEmailVal)) { return showMessage("Validation Error", "Invalid Organization Contact Email format.");}
    }
    if (planManagerEmailVal && !validateEmail(planManagerEmailVal)) { return showMessage("Validation Error", "Invalid Plan Manager Email format.");}


    showLoading("Saving portal settings...");
    // Update globalSettings object with form values
    // globalSettings.portalType is assumed to be set (e.g. during wizard) and not changed here directly

    if (currentPortalType === "organization") {
        globalSettings.organizationName = orgNameVal || globalSettings.organizationName;
        globalSettings.organizationAbn = orgAbnVal || globalSettings.organizationAbn; // Use new or keep old if empty
        globalSettings.organizationContactEmail = orgEmailVal || globalSettings.organizationContactEmail;
        globalSettings.organizationContactPhone = $("#adminEditOrgContactPhone")?.value.trim() || globalSettings.organizationContactPhone;
    } else { // For self-managed, these might be blank or derived differently
        globalSettings.organizationName = $("#adminEditParticipantName")?.value.trim() || globalSettings.participantName || "Participant Portal"; // Default org name for participant
        globalSettings.organizationAbn = ""; // Typically no org ABN for self-managed
        globalSettings.organizationContactEmail = "";
        globalSettings.organizationContactPhone = "";
    }
    globalSettings.participantName = $("#adminEditParticipantName")?.value.trim() || globalSettings.participantName;
    globalSettings.participantNdisNo = $("#adminEditParticipantNdisNo")?.value.trim() || globalSettings.participantNdisNo;
    globalSettings.planManagerName = $("#adminEditPlanManagerName")?.value.trim() || globalSettings.planManagerName;
    globalSettings.planManagerEmail = planManagerEmailVal || globalSettings.planManagerEmail;
    globalSettings.planManagerPhone = $("#adminEditPlanManagerPhone")?.value.trim() || globalSettings.planManagerPhone;
    globalSettings.planEndDate = $("#adminEditPlanEndDate")?.value || globalSettings.planEndDate; // Ensure valid date format
    globalSettings.agreementStartDate = globalSettings.agreementStartDate || new Date().toISOString().split('T')[0]; // Keep existing or default
    globalSettings.setupComplete = true; // Saving settings implies setup is considered complete or updated

    await saveGlobalSettingsToFirestore(); // Persist to Firestore
    hideLoading();
    showMessage("Settings Saved", "Global portal settings have been updated successfully.");
    loadAdminPortalSettings(); // Refresh form with potentially cleaned/saved values
    setActive(location.hash); // Refresh portal title if it depends on these settings
};

// Admin: Reset Global Settings to Defaults
window.resetGlobalSettingsToDefaults = function() {
    if (!(profile?.isAdmin)) {
        showMessage("Permission Denied", "You do not have permission to reset settings.");
        return;
    }
    // Confirmation dialog
    showMessage("Confirm Reset", 
        `Are you sure you want to reset all portal settings to their original defaults? This action cannot be undone.<br><br>
         <div class='modal-actions' style='justify-content: center; margin-top: 15px;'>
           <button onclick='_confirmResetGlobalSettingsFirestore()' class='btn-danger'><i class="fas fa-undo"></i> Yes, Reset</button>
           <button class='btn-secondary' onclick='closeModal("messageModal")'><i class="fas fa-times"></i> No, Cancel</button>
         </div>`);
};

window._confirmResetGlobalSettingsFirestore = async function() {
    closeModal("messageModal"); // Close confirmation
    showLoading("Resetting portal settings...");
    globalSettings = await getDefaultGlobalSettingsFirestore(); // Load the hardcoded defaults
    globalSettings.setupComplete = false; // Mark setup as incomplete
    await saveGlobalSettingsToFirestore(); // Save these defaults to Firestore
    hideLoading();
    showMessage("Portal Reset", "All portal settings have been reset to their defaults. The admin may need to run the setup wizard again.");

    // Refresh UI based on reset state
    if (location.hash === "#admin") { // If on admin page
        loadAdminPortalSettings(); // Reload settings in admin form
        if (!globalSettings.setupComplete) {
            openAdminSetupWizard(); // Prompt for setup again
        }
    } else { // If on other page, likely redirect or force admin setup
        if (authScreenElement) authScreenElement.style.display = "flex"; // Fallback to auth screen
        if (portalAppElement) portalAppElement.style.display = "none";
        if (profile && profile.isAdmin && !globalSettings.setupComplete) {
            openAdminSetupWizard(); // If admin is still logged in, open wizard
        }
    }
};

// Expose functions to global scope if they are called from HTML inline event handlers (legacy or specific cases)
// Many are already handled, this is a reminder for any new ones.
window.saveAdminAgreementCustomizations = saveAdminAgreementCustomizationsToFirestore;
window.clearAdminServiceForm = clearAdminServiceForm;
// approveWorkerInFirestore is already assigned to window at the end of the script.

// ========== INVOICE SPECIFIC LOGIC ==========
let invoiceItemCounter = 0; // Counter for unique IDs for invoice items

function addInvoiceRow(itemData = null, isLoadingFromDraft = false) {
    const tbody = $("#invTbl tbody");
    if (!tbody) return;

    // If table body has a placeholder row (e.g., "No items"), clear it
    if (tbody.rows.length === 1 && tbody.rows[0].cells.length === 1 && tbody.rows[0].cells[0].colSpan === 12) { // Adjust colspan if needed
        tbody.innerHTML = "";
    }

    const rowIndex = invoiceItemCounter++; // Unique ID for this row's elements
    const tr = tbody.insertRow();

    // Row Number
    tr.insertCell().textContent = tbody.rows.length;

    // Date
    const dateCell = tr.insertCell();
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.id = `itemDate${rowIndex}`;
    dateInput.className = 'invoice-input-condensed';
    dateInput.value = itemData?.date || new Date().toISOString().split('T')[0]; // Default to today or item data
    dateInput.onchange = calculateInvoiceTotals; // Recalculate when date changes (affects rate type)
    dateCell.appendChild(dateInput);

    // NDIS Code (for PDF/Print only) - hidden in interactive view
    const codeCellPrint = tr.insertCell();
    codeCellPrint.className = 'column-code print-only pdf-show'; // CSS handles visibility
    const codePrintSpan = document.createElement('span');
    codePrintSpan.id = `itemCodePrint${rowIndex}`;
    codePrintSpan.className = 'code-print-value';
    codePrintSpan.textContent = itemData?.serviceCode || "";
    codeCellPrint.appendChild(codePrintSpan);

    // Description (Select for interactive, Span for PDF/Print)
    const descCell = tr.insertCell();
    const descSelect = document.createElement('select');
    descSelect.id = `itemDesc${rowIndex}`;
    descSelect.className = 'invoice-input-condensed description-select'; // Class for styling
    descSelect.innerHTML = `<option value="">-- Select Service --</option>`; // Default option

    // Populate with authorized services
    const availableServices = adminManagedServices.filter(s =>
        profile.authorizedServiceCodes?.includes(s.code) // Only services authorized for the user
    );

    availableServices.forEach(service => {
        const opt = document.createElement('option');
        opt.value = service.code;
        opt.textContent = `${service.description} (${service.code})`;
        if (itemData?.serviceCode === service.code) opt.selected = true;
        descSelect.appendChild(opt);
    });
    if (availableServices.length === 0 && !(profile.authorizedServiceCodes && profile.authorizedServiceCodes.length > 0)) {
        descSelect.innerHTML = `<option value="">No services authorized</option>`;
    } else if (availableServices.length === 0) { // Authorized codes exist, but no matching services found (e.g. admin removed them)
         descSelect.innerHTML = `<option value="">No matching authorized services found</option>`;
    }


    descCell.appendChild(descSelect);
    const descPrintSpan = document.createElement('span'); // For print/PDF
    descPrintSpan.id = `itemDescPrint${rowIndex}`;
    descPrintSpan.className = 'description-print-value'; // CSS hides this in interactive
    descPrintSpan.textContent = itemData?.description || (adminManagedServices.find(s=>s.code === itemData?.serviceCode)?.description || "");
    descCell.appendChild(descPrintSpan);


    // Start Time
    const startCell = tr.insertCell();
    const startTimeInput = document.createElement('input');
    startTimeInput.type = 'text'; // Will be controlled by custom time picker
    startTimeInput.id = `itemStart${rowIndex}`;
    startTimeInput.className = 'custom-time-input invoice-input-condensed';
    startTimeInput.readOnly = true; // Prevent manual typing
    startTimeInput.placeholder = "Select Time";
    startTimeInput.value = itemData?.startTime ? formatTime12Hour(itemData.startTime) : "";
    startTimeInput.dataset.value24 = itemData?.startTime || ""; // Store 24hr format
    startTimeInput.onclick = () => openCustomTimePicker(startTimeInput, () => { // Open picker and set callback
        if (rateTypePrintSpan) rateTypePrintSpan.textContent = determineRateType(dateInput.value, startTimeInput.dataset.value24);
        calculateInvoiceTotals();
    });
    startCell.appendChild(startTimeInput);

    // End Time
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

    // Rate Type (for PDF/Print only)
    const rateTypeCellPrint = tr.insertCell();
    rateTypeCellPrint.className = 'column-rate-type print-only pdf-show';
    const rateTypePrintSpan = document.createElement('span');
    rateTypePrintSpan.id = `itemRateTypePrint${rowIndex}`;
    rateTypePrintSpan.className = 'rate-type-print-value';
    rateTypePrintSpan.textContent = itemData?.rateType || determineRateType(dateInput.value, startTimeInput.dataset.value24);
    rateTypeCellPrint.appendChild(rateTypePrintSpan);

    // Rate/Unit (for PDF/Print only)
    const rateUnitCellPrint = tr.insertCell();
    rateUnitCellPrint.className = 'print-only-column pdf-show'; // CSS class for print styling
    rateUnitCellPrint.id = `itemRateUnitPrint${rowIndex}`;
    rateUnitCellPrint.textContent = "$0.00"; // Will be updated by calculateInvoiceTotals or descSelect.onchange

    // Event listener for description select change (updates print spans, rate, travel input visibility)
    descSelect.onchange = (e) => {
        const selectedService = adminManagedServices.find(s => s.code === e.target.value);
        if(codePrintSpan) codePrintSpan.textContent = selectedService ? selectedService.code : "";
        if(descPrintSpan) descPrintSpan.textContent = selectedService ? selectedService.description : "N/A";
        const rt = determineRateType(dateInput.value, startTimeInput.dataset.value24);
        if(rateTypePrintSpan) rateTypePrintSpan.textContent = rt;

        // Update rate for print display based on selected service and rate type
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

        // Show/hide travel Km input and claim travel checkbox
        travelKmInput.style.display = (selectedService && selectedService.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) ? 'block' : 'none';
        if (selectedService && selectedService.categoryType !== SERVICE_CATEGORY_TYPES.TRAVEL_KM) travelKmInput.value = ""; // Clear Km if not travel service
        
        claimTravelLabel.style.display = (selectedService && selectedService.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) ? 'none' : 'flex';
        if (selectedService && selectedService.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) claimTravelCheckbox.checked = false; // Uncheck if it becomes a travel service

        calculateInvoiceTotals(); // Recalculate everything
    };


    // Hours/Km (Calculated)
    const hoursKmCell = tr.insertCell();
    hoursKmCell.id = `itemHoursKm${rowIndex}`;
    hoursKmCell.textContent = itemData?.hoursOrKm?.toFixed(2) || "0.00";

    // Travel Km Input (Interactive only)
    const travelInputCell = tr.insertCell();
    travelInputCell.className = 'no-print pdf-hide'; // Hide in print/PDF
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
    // Initial visibility based on loaded itemData or default service
    const initialServiceForTravel = adminManagedServices.find(s => s.code === descSelect.value);
    travelKmInput.style.display = (initialServiceForTravel && initialServiceForTravel.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) ? 'block' : 'none';

    // Claim Travel Checkbox (Interactive only)
    const claimTravelCell = tr.insertCell();
    claimTravelCell.className = 'no-print pdf-hide';
    const claimTravelLabel = document.createElement('label');
    claimTravelLabel.className = 'chk no-margin km-claim-toggle'; // For styling
    const claimTravelCheckbox = document.createElement('input');
    claimTravelCheckbox.type = 'checkbox';
    claimTravelCheckbox.id = `itemClaimTravel${rowIndex}`;
    claimTravelCheckbox.checked = itemData?.claimTravel || false;
    claimTravelCheckbox.onchange = calculateInvoiceTotals;
    claimTravelLabel.appendChild(claimTravelCheckbox);
    claimTravelLabel.appendChild(document.createTextNode(" Claim")); // Add space for label text
    claimTravelCell.appendChild(claimTravelLabel);
    // Initial visibility
    claimTravelLabel.style.display = (initialServiceForTravel && initialServiceForTravel.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM) ? 'none' : 'flex';


    // Total (Calculated)
    const totalCell = tr.insertCell();
    totalCell.id = `itemTotal${rowIndex}`;
    totalCell.textContent = itemData?.total ? `$${itemData.total.toFixed(2)}` : "$0.00";

    // Actions (Delete Row - Interactive only)
    const actionsCell = tr.insertCell();
    actionsCell.className = 'no-print pdf-hide';
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteBtn.className = 'btn-danger btn-small delete-row-btn';
    deleteBtn.title = "Delete Row";
    deleteBtn.onclick = () => {
        tr.remove();
        // Re-number rows after deletion
        $$("#invTbl tbody tr").forEach((r, idx) => { r.cells[0].textContent = idx + 1; });
        calculateInvoiceTotals();
    };
    actionsCell.appendChild(deleteBtn);

    // If loading from draft, ensure print spans are correctly populated
    if (isLoadingFromDraft && itemData) {
        if (codePrintSpan) codePrintSpan.textContent = itemData.serviceCode || "";
        if (descPrintSpan) descPrintSpan.textContent = itemData.description || ""; // Use stored description
        if (rateTypePrintSpan) rateTypePrintSpan.textContent = itemData.rateType || ""; // Use stored rate type
        // Rate/Unit for print will be set by calculateInvoiceTotals or descSelect.onchange if needed
    } else { // For new row, initialize print spans from select/inputs
         if (codePrintSpan && descSelect.value) codePrintSpan.textContent = descSelect.value;
         if (descPrintSpan && descSelect.options[descSelect.selectedIndex]) descPrintSpan.textContent = descSelect.options[descSelect.selectedIndex].text.split(' (')[0]; // Get text part
         if (rateTypePrintSpan) rateTypePrintSpan.textContent = determineRateType(dateInput.value, startTimeInput.dataset.value24);
    }

    calculateInvoiceTotals(); // Initial calculation for the new row
}


function calculateInvoiceTotals() {
    let subtotal = 0;
    const rows = $$("#invTbl tbody tr");

    rows.forEach((row) => {
        const dateInput = row.querySelector(`input[id^="itemDate"]`);
        const descSelect = row.querySelector(`select[id^="itemDesc"]`);
        const startTimeInput = row.querySelector(`input[id^="itemStart"]`);
        const endTimeInput = row.querySelector(`input[id^="itemEnd"]`);
        const travelKmInput = row.querySelector(`input[id^="itemTravel"]`); // For travel type services or claimed travel
        const claimTravelCheckbox = row.querySelector(`input[id^="itemClaimTravel"]`);

        // Cells to update
        const hoursKmCell = row.cells[8]; // Assuming Hours/Km is cell index 8
        const totalCell = row.cells[10];   // Assuming Total is cell index 10
        const rateUnitPrintCell = row.cells[7]; // Assuming Rate/Unit (for print) is cell index 7

        const serviceCode = descSelect?.value;
        // Authorization check (important for users, admin might bypass or have different logic)
        if (!profile.isAdmin && profile.authorizedServiceCodes && !profile.authorizedServiceCodes.includes(serviceCode) && serviceCode !== "") {
            console.warn(`Service code ${serviceCode} is not authorized for this user.`);
            totalCell.textContent = "$0.00"; // Zero out if not authorized
            if(rateUnitPrintCell) rateUnitPrintCell.textContent = "$0.00";
            hoursKmCell.textContent = "0.00";
            return; // Skip to next row
        }

        const service = adminManagedServices.find(s => s.code === serviceCode);
        let itemTotal = 0;
        let hours = 0;
        let km = 0;
        let rateForPrint = 0; // The rate per unit (hour or km) to display

        if (service) {
            const itemDate = dateInput?.value;
            const startTime = startTimeInput?.dataset.value24;
            const endTime = endTimeInput?.dataset.value24;

            // Update print-only spans for description, code, rate type
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
                if(rateTypePrintSpan) rateTypePrintSpan.textContent = "Travel"; // Override for travel
            } else { // Non-travel services (Core, Capacity Building)
                hours = calculateHours(startTime, endTime);
                hoursKmCell.textContent = hours.toFixed(2);

                const rateType = determineRateType(itemDate, startTime);
                if(rateTypePrintSpan) rateTypePrintSpan.textContent = rateType;

                if (service.categoryType === SERVICE_CATEGORY_TYPES.CORE_STANDARD || service.categoryType === SERVICE_CATEGORY_TYPES.CORE_HIGH_INTENSITY) {
                    rateForPrint = service.rates?.[rateType] || service.rates?.weekday || 0; // Fallback to weekday
                } else if (service.categoryType === SERVICE_CATEGORY_TYPES.CAPACITY_THERAPY_STD || service.categoryType === SERVICE_CATEGORY_TYPES.CAPACITY_SPECIALIST || service.categoryType === SERVICE_CATEGORY_TYPES.OTHER_FLAT_RATE) {
                    rateForPrint = service.rates?.standardRate || 0;
                }
                itemTotal = hours * rateForPrint;

                // Add claimed travel cost if applicable
                if (claimTravelCheckbox?.checked && service.travelCode) { // If "Claim Travel" is checked and service has an associated travelCode
                    const travelService = adminManagedServices.find(ts => ts.code === service.travelCode && ts.categoryType === SERVICE_CATEGORY_TYPES.TRAVEL_KM);
                    const travelKmForThisService = parseFloat(travelKmInput?.value) || 0; // Use the same Km input for claimed travel with non-travel service
                    if (travelService && travelKmForThisService > 0) {
                        const travelRate = travelService.rates?.perKmRate || 0;
                        itemTotal += travelKmForThisService * travelRate;
                        // Note: This adds to the itemTotal of the main service. Consider if travel should be a separate line item.
                        // For simplicity here, it's added to the main service's total.
                    }
                }
            }
        }
        totalCell.textContent = `$${itemTotal.toFixed(2)}`;
        if(rateUnitPrintCell) rateUnitPrintCell.textContent = `$${parseFloat(rateForPrint).toFixed(2)}`;
        subtotal += itemTotal;
    });

    // Update overall totals
    $("#sub").textContent = `$${subtotal.toFixed(2)}`;
    let gstAmount = 0;
    if (profile.gstRegistered) { // Check if provider is GST registered
        gstAmount = subtotal * 0.10; // Calculate 10% GST
        $("#gst").textContent = `$${gstAmount.toFixed(2)}`;
        $("#gstRow").style.display = 'flex'; // Show GST row
    } else {
        $("#gst").textContent = "$0.00";
        $("#gstRow").style.display = 'none'; // Hide GST row
    }
    $("#grand").textContent = `$${(subtotal + gstAmount).toFixed(2)}`; // Grand total
}

// REMOVED DUPLICATE DEFINITION OF loadAdminInvoiceCustomizations
// The original second definition was here.

async function saveAdminInvoiceCustomizations() { // Placeholder
    showMessage("Info", "Saving invoice customizations is not yet implemented.")
}
window.approveWorkerInFirestore = approveWorkerInFirestore; // Ensure it's globally available if called by string onclick
