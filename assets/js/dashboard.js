var LeaveApp = LeaveApp || {};

LeaveApp.Dashboard = (function () {
    var LEAVE_TYPES = ['Annual/Holiday', 'Birthday', 'Sick', 'Personal/Compassionate', 'Unpaid', 'Other'];

    function init() {
        render();
    }

    function applyFilters(leaveData, allowanceData, filters) {
        return leaveData.filter(function (r) {
            if (filters.employee && r.employee !== filters.employee) return false;
            if (filters.type && r.type !== filters.type) return false;
            if (filters.department) {
                var emp = allowanceData.find(function (a) { return a.employee === r.employee; });
                if (!emp || emp.department !== filters.department) return false;
            }
            return true;
        });
    }

    // Get leave records within an employee's current leave year
    function empLeaveYear(allFiltered, emp) {
        var period = LeaveApp.Utils.getLeaveYear(emp.leaveYearStartDay, emp.leaveYearStartMonth);
        return allFiltered.filter(function (r) {
            return r.employee === emp.employee && LeaveApp.Utils.isInRange(r, period.from, period.to);
        });
    }

    function sumByType(records, type) {
        return records
            .filter(function (r) { return r.type === type; })
            .reduce(function (s, r) { return s + r.days; }, 0);
    }

    function render() {
        var filters = LeaveApp.App.getFilters();
        var leaveData = LeaveApp.Data.getLeaveData();
        var allowanceData = LeaveApp.Data.getAllowanceData();
        var filtered = applyFilters(leaveData, allowanceData, filters);

        renderStats(filtered, allowanceData);
        renderAllowanceTable(filtered, allowanceData, filters);
        renderTypeBreakdown(filtered);
        renderMonthlyTrend(filtered);
        renderRecentRequests(filtered);
    }

    // ---- Stats Cards ----
    function renderStats(filtered, allowanceData) {
        var el = document.getElementById('stats-row');
        var today = new Date();
        today.setHours(0, 0, 0, 0);

        var offToday = filtered.filter(function (r) {
            var s = new Date(r.startDate); s.setHours(0, 0, 0, 0);
            var e = new Date(r.endDate); e.setHours(0, 0, 0, 0);
            return s <= today && e >= today;
        }).length;

        var next7 = new Date(today);
        next7.setDate(next7.getDate() + 7);
        var upcoming = filtered.filter(function (r) {
            var s = new Date(r.startDate); s.setHours(0, 0, 0, 0);
            return s > today && s <= next7;
        }).length;

        // Total days across all employees' current leave years
        var totalDays = 0;
        var uniqueEmps = {};
        allowanceData.forEach(function (emp) {
            var empRecords = empLeaveYear(filtered, emp);
            var days = empRecords.reduce(function (s, r) { return s + r.days; }, 0);
            totalDays += days;
            if (days > 0) uniqueEmps[emp.employee] = true;
        });
        var empCount = Object.keys(uniqueEmps).length;

        el.innerHTML =
            statCard('Off Today', offToday, 'Currently on leave') +
            statCard('Next 7 Days', upcoming, 'Upcoming leave') +
            statCard('Total Days', totalDays, 'Across current leave years') +
            statCard('Employees', empCount, 'Have taken leave');
    }

    function statCard(label, value, sub) {
        return '<div class="card stat-card">' +
            '<div class="stat-value">' + value + '</div>' +
            '<div class="stat-label">' + label + '</div>' +
            '<div class="stat-sub">' + sub + '</div>' +
            '</div>';
    }

    // ---- Allowance Table ----
    function renderAllowanceTable(filtered, allowanceData, filters) {
        var table = document.getElementById('allowance-table');

        var employees = allowanceData.slice();
        if (filters.employee) {
            employees = employees.filter(function (a) { return a.employee === filters.employee; });
        }
        if (filters.department) {
            employees = employees.filter(function (a) { return a.department === filters.department; });
        }
        employees.sort(function (a, b) { return a.employee.localeCompare(b.employee); });

        var header = '<thead><tr>' +
            '<th>Employee</th>' +
            '<th>Dept</th>' +
            '<th>Leave Year</th>' +
            '<th>Annual Used</th>' +
            '<th>Annual Left</th>' +
            '<th>Birthday</th>' +
            '<th>Sick</th>' +
            '<th>Compassionate</th>' +
            '<th>Unpaid</th>' +
            '<th>Total</th>' +
            '</tr></thead>';

        var rows = employees.map(function (emp) {
            var period = LeaveApp.Utils.getLeaveYear(emp.leaveYearStartDay, emp.leaveYearStartMonth);
            var empRecords = empLeaveYear(filtered, emp);

            var annual = sumByType(empRecords, 'Annual/Holiday');
            var birthday = sumByType(empRecords, 'Birthday');
            var sick = sumByType(empRecords, 'Sick');
            var personal = sumByType(empRecords, 'Personal/Compassionate');
            var unpaid = sumByType(empRecords, 'Unpaid');
            var other = sumByType(empRecords, 'Other');
            var total = annual + birthday + sick + personal + unpaid + other;

            var annualLeft = emp.annualAllowance - annual;
            var birthdayLeft = emp.birthdayAllowance - birthday;

            // Format leave year period
            var fromStr = LeaveApp.Utils.formatDate(period.from);
            var toStr = LeaveApp.Utils.formatDate(period.to);

            return '<tr>' +
                '<td class="fw-bold">' + esc(emp.employee) + '</td>' +
                '<td class="muted">' + esc(emp.department) + '</td>' +
                '<td class="muted" style="font-size:0.78rem;white-space:nowrap">' + fromStr + ' — ' + toStr + '</td>' +
                '<td>' + annual + '</td>' +
                '<td class="' + (annualLeft <= 3 ? 'warn' : 'good') + '">' + annualLeft + ' / ' + emp.annualAllowance + '</td>' +
                '<td>' + birthday + ' / ' + emp.birthdayAllowance + '</td>' +
                '<td>' + sick + '</td>' +
                '<td>' + personal + '</td>' +
                '<td>' + unpaid + '</td>' +
                '<td class="fw-bold">' + total + '</td>' +
                '</tr>';
        }).join('');

        table.innerHTML = header + '<tbody>' + rows + '</tbody>';

        // Update the year badge to say "Current Leave Years"
        document.getElementById('year-badge').textContent = 'Current Leave Years';
    }

    // ---- Type Breakdown ----
    function renderTypeBreakdown(filtered) {
        var container = document.getElementById('type-breakdown');
        var allowanceData = LeaveApp.Data.getAllowanceData();

        // Sum across all employees' current leave years
        var typeTotals = {};
        LEAVE_TYPES.forEach(function (t) { typeTotals[t] = 0; });
        allowanceData.forEach(function (emp) {
            var empRecords = empLeaveYear(filtered, emp);
            LEAVE_TYPES.forEach(function (t) {
                typeTotals[t] += sumByType(empRecords, t);
            });
        });

        var counts = LEAVE_TYPES.map(function (t) { return typeTotals[t]; });
        var max = Math.max.apply(null, counts) || 1;

        var html = '<h3>Leave by Type</h3>';
        LEAVE_TYPES.forEach(function (t, i) {
            var pct = Math.round((counts[i] / max) * 100);
            html += '<div class="bar-row">' +
                '<span class="bar-label">' + t + '</span>' +
                '<div class="bar-track">' +
                '<div class="bar-fill" data-type="' + t + '" style="width:' + pct + '%"></div>' +
                '</div>' +
                '<span class="bar-value">' + counts[i] + ' days</span>' +
                '</div>';
        });
        container.innerHTML = html;
    }

    // ---- Monthly Trend (calendar year for overview) ----
    function renderMonthlyTrend(filtered) {
        var container = document.getElementById('monthly-trend');
        var currentYear = new Date().getFullYear();
        var calYear = filtered.filter(function (r) {
            return r.startDate.getFullYear() === currentYear;
        });

        var months = [];
        for (var m = 0; m < 12; m++) {
            var monthLeave = calYear.filter(function (r) { return r.startDate.getMonth() === m; });
            months.push({
                label: LeaveApp.Utils.monthName(m).substring(0, 3),
                days: monthLeave.reduce(function (s, r) { return s + r.days; }, 0)
            });
        }
        var max = Math.max.apply(null, months.map(function (m) { return m.days; })) || 1;

        var html = '<h3>Monthly Trend (' + currentYear + ')</h3><div class="chart-bars">';
        months.forEach(function (m) {
            var pct = Math.round((m.days / max) * 100);
            html += '<div class="chart-col">' +
                '<div class="chart-bar-wrap">' +
                '<div class="chart-bar" style="height:' + pct + '%" data-value="' + m.days + '"></div>' +
                '</div>' +
                '<span class="chart-label">' + m.label + '</span>' +
                '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // ---- Recent Requests ----
    function renderRecentRequests(filtered) {
        var table = document.getElementById('requests-table');
        var sorted = filtered.slice().sort(function (a, b) {
            return b.startDate.getTime() - a.startDate.getTime();
        }).slice(0, 25);

        var header = '<thead><tr>' +
            '<th>Employee</th>' +
            '<th>Type</th>' +
            '<th>Start</th>' +
            '<th>End</th>' +
            '<th>Days</th>' +
            '<th>Notes</th>' +
            '</tr></thead>';

        var rows = sorted.map(function (r) {
            return '<tr>' +
                '<td class="fw-bold">' + esc(r.employee) + '</td>' +
                '<td><span class="type-badge" data-type="' + esc(r.type) + '">' + esc(r.type) + '</span></td>' +
                '<td>' + LeaveApp.Utils.formatDate(r.startDate) + '</td>' +
                '<td>' + LeaveApp.Utils.formatDate(r.endDate) + '</td>' +
                '<td>' + r.days + '</td>' +
                '<td class="muted">' + (r.notes ? esc(r.notes) : '—') + '</td>' +
                '</tr>';
        }).join('');

        table.innerHTML = header + '<tbody>' + rows + '</tbody>';
    }

    function esc(s) { return LeaveApp.Utils.escapeHtml(s); }

    return { init: init, render: render };
})();
