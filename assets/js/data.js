var LeaveApp = LeaveApp || {};

LeaveApp.Data = (function () {
    var _config = { leaveUrl: '', allowanceUrl: '' };
    var _leaveData = [];
    var _allowanceData = [];
    var _listeners = [];
    var _lastFetch = null;

    function parseCSVLine(line) {
        var result = [];
        var current = '';
        var inQuotes = false;
        for (var i = 0; i < line.length; i++) {
            var ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else if (ch === '"') {
                    inQuotes = false;
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    result.push(current);
                    current = '';
                } else {
                    current += ch;
                }
            }
        }
        result.push(current);
        return result;
    }

    function parseCSV(text) {
        var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        if (lines.length < 2) return [];
        var headers = parseCSVLine(lines[0]);
        var rows = [];
        for (var i = 1; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var values = parseCSVLine(line);
            var obj = {};
            for (var j = 0; j < headers.length; j++) {
                obj[headers[j].trim()] = (values[j] || '').trim();
            }
            rows.push(obj);
        }
        return rows;
    }

    function transformLeave(raw) {
        // Map actual Google Form headers to internal field names
        var employee = raw['Employee Name'] || raw['Name'] || '';
        var type = raw['Leave Type'] || '';
        var start = LeaveApp.Utils.parseDate(raw['Start Date']);
        var end = LeaveApp.Utils.parseDate(raw['End Date'] || raw['Last working day of your leave']);
        var notes = raw['Notes'] || raw['Reason'] || '';

        // Normalise leave type names (e.g. "Annual" -> "Annual/Holiday")
        var typeMap = {
            'Annual': 'Annual/Holiday',
            'Sick': 'Sick',
            'Birthday': 'Birthday',
            'Personal': 'Personal/Compassionate',
            'Compassionate': 'Personal/Compassionate',
            'Unpaid': 'Unpaid'
        };
        type = typeMap[type] || type;

        return {
            timestamp: raw['Timestamp'] || '',
            employee: employee,
            type: type,
            startDate: start,
            endDate: end,
            notes: notes,
            days: (start && end) ? LeaveApp.Utils.businessDays(start, end) : 0
        };
    }

    function transformAllowance(raw) {
        // Parse leave year start - supports month names or DD/MM
        var startStr = raw['Leave Start Date'] || raw['Leave Year Start'] || '';
        var monthNames = {
            'january': 1, 'february': 2, 'march': 3, 'april': 4,
            'may': 5, 'june': 6, 'july': 7, 'august': 8,
            'september': 9, 'october': 10, 'november': 11, 'december': 12
        };
        var startMonth = 1;
        var startDay = 1;
        var lower = startStr.trim().toLowerCase();
        if (monthNames[lower]) {
            startMonth = monthNames[lower];
        } else if (startStr.indexOf('/') !== -1) {
            var parts = startStr.trim().split('/');
            startDay = parseInt(parts[0], 10) || 1;
            startMonth = parseInt(parts[1], 10) || 1;
        }

        return {
            employee: raw['Employee Name'] || raw['Name'] || '',
            annualAllowance: parseInt(raw['Annual Allowance'], 10) || 28,
            birthdayAllowance: parseInt(raw['Birthday Leave'] || raw['Birthday'], 10) || 1,
            department: raw['Role / Department'] || raw['Department'] || '',
            leaveYearStartDay: startDay,
            leaveYearStartMonth: startMonth
        };
    }

    function fetchAll() {
        var p1 = fetch(_config.leaveUrl).then(function (r) { return r.text(); });
        var p2 = fetch(_config.allowanceUrl).then(function (r) { return r.text(); });

        return Promise.all([p1, p2]).then(function (results) {
            var rawLeave = parseCSV(results[0]);
            _leaveData = rawLeave.map(transformLeave).filter(function (r) {
                return r.startDate && r.endDate && r.employee;
            });

            // The allowance sheet has an extra column-letter row (,A,B,C,D) as its
            // first line — strip it so the real header row is used instead.
            var allowanceText = results[1];
            var allowanceLines = allowanceText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            if (allowanceLines.length > 0 && /^,?[A-Z](,[A-Z])*$/.test(allowanceLines[0].trim())) {
                allowanceText = allowanceLines.slice(1).join('\n');
            }
            var rawAllowance = parseCSV(allowanceText);
            _allowanceData = rawAllowance.map(transformAllowance).filter(function (a) {
                return a.employee;
            });

            _lastFetch = new Date();
            _listeners.forEach(function (fn) { fn(); });
        });
    }

    function init(leaveUrl, allowanceUrl) {
        _config.leaveUrl = leaveUrl;
        _config.allowanceUrl = allowanceUrl;
        return fetchAll();
    }

    function startAutoRefresh(ms) {
        setInterval(fetchAll, ms || 300000);
    }

    function onDataChange(fn) { _listeners.push(fn); }
    function getLeaveData() { return _leaveData; }
    function getAllowanceData() { return _allowanceData; }
    function getLastFetch() { return _lastFetch; }

    function getEmployeeNames() {
        var names = {};
        _allowanceData.forEach(function (a) { names[a.employee] = true; });
        _leaveData.forEach(function (r) { names[r.employee] = true; });
        return Object.keys(names).sort();
    }

    function getDepartments() {
        var depts = {};
        _allowanceData.forEach(function (a) {
            if (a.department) depts[a.department] = true;
        });
        return Object.keys(depts).sort();
    }

    return {
        init: init,
        fetchAll: fetchAll,
        startAutoRefresh: startAutoRefresh,
        onDataChange: onDataChange,
        getLeaveData: getLeaveData,
        getAllowanceData: getAllowanceData,
        getEmployeeNames: getEmployeeNames,
        getDepartments: getDepartments,
        getLastFetch: getLastFetch
    };
})();
