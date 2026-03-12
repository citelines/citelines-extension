// Admin Dashboard - Shared State

const API_URL = window.location.origin;
let JWT_TOKEN = localStorage.getItem('admin_jwt');
let currentUser = null;
let usersData = [];
let citationsData = [];
let auditData = [];
let reportsData = [];
let analyticsData = null;
let currentAction = null;
let selectedCitations = new Set();
let usersSortColumn = 'created_at';
let usersSortDirection = 'desc';
let citationsSortColumn = 'created_at';
let citationsSortDirection = 'desc';
let usersFilters = {}; // { columnName: [selectedValues] }
let citationsFilters = {}; // { columnName: [selectedValues] }
let activeFilterDropdown = null;
let activeFilterTrigger = null; // Track the th element that opened the dropdown
let currentUserDetailsId = null; // Track the user ID being viewed in modal
