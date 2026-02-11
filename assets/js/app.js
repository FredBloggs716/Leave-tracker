var LeaveApp = LeaveApp || {};

LeaveApp.App = (function () {
    // ================================================================
    //  CONFIGURATION — Update these after publishing your Google Sheet
    // ================================================================
    var LEAVE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRMg7-SQEZTk1uOc7gbjN1RWY9GhUL3fYGQrxIiX8jBcDYyrIdEYRzOBY1tKpsIXxk_nmgtQrqQlzI/pub?gid=218433124&single=true&output=csv';
    var ALLOWANCE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRMg7-SQEZTk1uOc7gbjN1RWY9GhUL3fYGQrxIiX8jBcDYyrIdEYRzOBY1tKpsIXxk_nmgtQrqQlzI/pub?gid=1812710023&single=true&output=csv';
    var GOOGLE_FORM_URL = 'YOUR_GOOGLE_FORM_URL_HERE';
    // ================================================================

    var _currentView = 'dashboard';

    function init() {
        // Footer year
        var yearEl = document.getElementById('footer-year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();

        // Form link
        var formLink = document.getElementById('form-link');
        if (formLink && GOOGLE_FORM_URL !== 'YOUR_GOOGLE_FORM_URL_HERE') {
            formLink.href = GOOGLE_FORM_URL;
        }

        // View switching
        document.querySelectorAll('.nav-btn[data-view]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                switchView(btn.getAttribute('data-view'));
                // Close mobile nav
                document.querySelector('.nav').classList.remove('open');
            });
        });

        // Mobile nav toggle
        var toggle = document.querySelector('.nav-toggle');
        var nav = document.querySelector('.nav');
        if (toggle) {
            toggle.addEventListener('click', function () {
                var open = nav.classList.toggle('open');
                toggle.setAttribute('aria-expanded', open);
            });
        }

        // Filters
        ['filter-employee', 'filter-type', 'filter-department'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('change', onFilterChange);
        });

        // Refresh button
        var refreshBtn = document.getElementById('btn-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                refreshBtn.classList.add('spinning');
                LeaveApp.Data.fetchAll().then(function () {
                    refreshBtn.classList.remove('spinning');
                    updateLastFetch();
                }).catch(function () {
                    refreshBtn.classList.remove('spinning');
                });
            });
        }

        // Modal
        document.getElementById('modal-close').addEventListener('click', closeModal);
        document.getElementById('modal-overlay').addEventListener('click', function (e) {
            if (e.target === this) closeModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeModal();
        });

        // Load data
        showLoading(true);

        if (LEAVE_SHEET_URL === 'YOUR_LEAVE_SHEET_CSV_URL_HERE') {
            showLoading(false);
            showError('Please configure your Google Sheet URLs in assets/js/app.js before using the app.');
            loadDemoData();
            return;
        }

        LeaveApp.Data.init(LEAVE_SHEET_URL, ALLOWANCE_SHEET_URL)
            .then(function () {
                showLoading(false);
                populateFilters();
                LeaveApp.Calendar.init();
                LeaveApp.Dashboard.init();
                updateLastFetch();

                LeaveApp.Data.onDataChange(function () {
                    populateFilters();
                    LeaveApp.Calendar.render();
                    LeaveApp.Dashboard.render();
                    updateLastFetch();
                });
                LeaveApp.Data.startAutoRefresh(300000);
            })
            .catch(function (err) {
                showLoading(false);
                showError('Failed to load data. Check that the Google Sheet is published to the web and the URLs in app.js are correct.');
                console.error('Leave Tracker load error:', err);
            });
    }

    // ---- Demo data for first-time setup ----
    function loadDemoData() {
        var demoLeave = generateDemoLeave();
        var demoAllowance = generateDemoAllowances();

        // Inject demo data directly
        LeaveApp.Data._demo = true;
        LeaveApp.Data.getLeaveData = function () { return demoLeave; };
        LeaveApp.Data.getAllowanceData = function () { return demoAllowance; };
        LeaveApp.Data.getEmployeeNames = function () {
            return demoAllowance.map(function (a) { return a.employee; }).sort();
        };
        LeaveApp.Data.getDepartments = function () {
            var d = {};
            demoAllowance.forEach(function (a) { if (a.department) d[a.department] = true; });
            return Object.keys(d).sort();
        };
        LeaveApp.Data.getLastFetch = function () { return new Date(); };

        populateFilters();
        LeaveApp.Calendar.init();
        LeaveApp.Dashboard.init();
    }

    function generateDemoAllowances() {
        var names = [
            { name: 'Dean Bradley', annual: 33 },
            { name: 'Sam Legg', annual: 33 },
            { name: 'George Gulliver', annual: 28 },
            { name: 'Luke Weston', annual: 28 },
            { name: 'Ben Penneck', annual: 28 },
            { name: 'Izzy Bradley', annual: 10 },
            { name: 'Mike Howson', annual: 28 },
            { name: 'Alex Hamlin', annual: 28 }
        ];
        return names.map(function (e) {
            return {
                employee: e.name,
                annualAllowance: e.annual,
                birthdayAllowance: 1,
                department: '',
                leaveYearStartDay: 1,
                leaveYearStartMonth: 1
            };
        });
    }

    function generateDemoLeave() {
        var names = [
            'Dean Bradley', 'Sam Legg', 'George Gulliver', 'Luke Weston',
            'Ben Penneck', 'Izzy Bradley', 'Mike Howson', 'Alex Hamlin'
        ];
        var types = ['Annual/Holiday', 'Annual/Holiday', 'Sick', 'Birthday',
            'Personal/Compassionate', 'Annual/Holiday', 'Unpaid'];
        var records = [];
        var year = new Date().getFullYear();
        var month = new Date().getMonth();

        for (var i = 0; i < 20; i++) {
            var emp = names[i % names.length];
            var type = types[i % types.length];
            var m = month + Math.floor(i / 5) - 1;
            if (m < 0) m = 0;
            if (m > 11) m = 11;
            var day = 3 + (i * 3) % 20;
            var start = new Date(year, m, day);
            var dur = type === 'Birthday' ? 1 : (type === 'Sick' ? 2 : 3 + (i % 4));
            var end = new Date(start);
            end.setDate(end.getDate() + dur - 1);

            records.push({
                timestamp: '',
                employee: emp,
                type: type,
                startDate: start,
                endDate: end,
                notes: type === 'Annual/Holiday' ? 'Holiday' : '',
                days: LeaveApp.Utils.businessDays(start, end)
            });
        }
        return records;
    }

    // ---- View switching ----
    function switchView(view) {
        _currentView = view;
        document.querySelectorAll('.view').forEach(function (el) {
            el.classList.toggle('active', el.id === 'view-' + view);
        });
        document.querySelectorAll('.nav-btn[data-view]').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-view') === view);
        });
    }

    // ---- Filters ----
    function getFilters() {
        return {
            employee: document.getElementById('filter-employee').value,
            type: document.getElementById('filter-type').value,
            department: document.getElementById('filter-department').value
        };
    }

    function populateFilters() {
        var empSelect = document.getElementById('filter-employee');
        var curEmp = empSelect.value;
        var names = LeaveApp.Data.getEmployeeNames();
        empSelect.innerHTML = '<option value="">All Employees</option>';
        names.forEach(function (n) {
            var opt = document.createElement('option');
            opt.value = n;
            opt.textContent = n;
            empSelect.appendChild(opt);
        });
        empSelect.value = curEmp;

        var deptSelect = document.getElementById('filter-department');
        var curDept = deptSelect.value;
        var depts = LeaveApp.Data.getDepartments();
        deptSelect.innerHTML = '<option value="">All Departments</option>';
        depts.forEach(function (d) {
            var opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            deptSelect.appendChild(opt);
        });
        deptSelect.value = curDept;
    }

    function onFilterChange() {
        LeaveApp.Calendar.render();
        LeaveApp.Dashboard.render();
    }

    // ---- Modal ----
    function showLeaveDetail(record) {
        var title = record.employee + ' — ' + record.type;
        var body = '<div class="detail-row"><span class="detail-label">Type</span>' +
            '<span><span class="type-badge" data-type="' + esc(record.type) + '">' + esc(record.type) + '</span></span></div>' +
            '<div class="detail-row"><span class="detail-label">Start Date</span>' +
            '<span class="detail-value">' + LeaveApp.Utils.formatDate(record.startDate) + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">End Date</span>' +
            '<span class="detail-value">' + LeaveApp.Utils.formatDate(record.endDate) + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Business Days</span>' +
            '<span class="detail-value">' + record.days + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Notes</span>' +
            '<span class="detail-value">' + (record.notes ? esc(record.notes) : '—') + '</span></div>';
        showModal(title, body);
    }

    function showModal(title, bodyHtml) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHtml;
        document.getElementById('modal-overlay').classList.add('active');
    }

    function closeModal() {
        document.getElementById('modal-overlay').classList.remove('active');
    }

    // ---- Loading / Error ----
    function showLoading(on) {
        document.getElementById('loading-overlay').classList.toggle('active', on);
    }

    function showError(msg) {
        var banner = document.getElementById('error-banner');
        document.getElementById('error-message').textContent = msg;
        banner.hidden = false;
    }

    function updateLastFetch() {
        var d = LeaveApp.Data.getLastFetch();
        if (!d) return;
        var el = document.getElementById('last-updated');
        if (el) {
            var h = d.getHours().toString().padStart(2, '0');
            var m = d.getMinutes().toString().padStart(2, '0');
            el.textContent = 'Updated ' + h + ':' + m;
        }
    }

    function esc(s) { return LeaveApp.Utils.escapeHtml(s); }

    return {
        init: init,
        getFilters: getFilters,
        showLeaveDetail: showLeaveDetail,
        showModal: showModal
    };
})();

document.addEventListener('DOMContentLoaded', LeaveApp.App.init);
