var LeaveApp = LeaveApp || {};

LeaveApp.Calendar = (function () {
    var _year, _month;
    var _gridEl, _titleEl;
    var MAX_PILLS = 3;

    function init() {
        _gridEl = document.getElementById('calendar-grid');
        _titleEl = document.getElementById('cal-title');

        var now = new Date();
        _year = now.getFullYear();
        _month = now.getMonth();

        document.getElementById('cal-prev').addEventListener('click', function () { navigate(-1); });
        document.getElementById('cal-next').addEventListener('click', function () { navigate(1); });
        document.getElementById('cal-today').addEventListener('click', function () {
            var n = new Date();
            _year = n.getFullYear();
            _month = n.getMonth();
            render();
        });

        render();
    }

    function navigate(delta) {
        _month += delta;
        if (_month < 0) { _month = 11; _year--; }
        if (_month > 11) { _month = 0; _year++; }
        render();
    }

    function render() {
        var filters = LeaveApp.App.getFilters();
        var leaveData = LeaveApp.Data.getLeaveData();
        var allowanceData = LeaveApp.Data.getAllowanceData();

        var filtered = leaveData.filter(function (r) {
            if (filters.employee && r.employee !== filters.employee) return false;
            if (filters.type && r.type !== filters.type) return false;
            if (filters.department) {
                var emp = allowanceData.find(function (a) { return a.employee === r.employee; });
                if (!emp || emp.department !== filters.department) return false;
            }
            return true;
        });

        var firstDay = new Date(_year, _month, 1);
        var lastDay = new Date(_year, _month + 1, 0);
        var startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
        var startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - startOffset);

        _titleEl.textContent = LeaveApp.Utils.monthName(_month) + ' ' + _year;

        _gridEl.innerHTML = '';

        // Day headers (Mon–Sun)
        var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        days.forEach(function (d) {
            var hdr = document.createElement('div');
            hdr.className = 'day-header';
            hdr.textContent = d;
            _gridEl.appendChild(hdr);
        });

        var today = new Date();
        today.setHours(0, 0, 0, 0);

        var totalCells = 42;
        for (var i = 0; i < totalCells; i++) {
            var cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);
            cellDate.setHours(0, 0, 0, 0);

            var cell = document.createElement('div');
            cell.className = 'day-cell';

            if (cellDate.getTime() === today.getTime()) cell.classList.add('today');
            if (cellDate.getMonth() !== _month) cell.classList.add('outside');
            var dow = cellDate.getDay();
            if (dow === 0 || dow === 6) cell.classList.add('weekend');

            var num = document.createElement('div');
            num.className = 'day-number';
            num.textContent = cellDate.getDate();
            cell.appendChild(num);

            var cellTime = cellDate.getTime();
            var matches = filtered.filter(function (r) {
                var s = new Date(r.startDate); s.setHours(0, 0, 0, 0);
                var e = new Date(r.endDate); e.setHours(0, 0, 0, 0);
                return cellTime >= s.getTime() && cellTime <= e.getTime();
            });

            matches.slice(0, MAX_PILLS).forEach(function (r) {
                var pill = document.createElement('div');
                pill.className = 'leave-pill';
                pill.setAttribute('data-type', r.type);
                pill.textContent = r.employee;
                pill.title = r.employee + ' — ' + r.type;
                pill.addEventListener('click', function (e) {
                    e.stopPropagation();
                    LeaveApp.App.showLeaveDetail(r);
                });
                cell.appendChild(pill);
            });

            if (matches.length > MAX_PILLS) {
                var more = document.createElement('div');
                more.className = 'leave-more';
                more.textContent = '+' + (matches.length - MAX_PILLS) + ' more';
                (function (dayMatches) {
                    more.addEventListener('click', function (e) {
                        e.stopPropagation();
                        showDaySummary(cellDate, dayMatches);
                    });
                })(matches);
                cell.appendChild(more);
            }

            _gridEl.appendChild(cell);
        }
    }

    function showDaySummary(date, records) {
        var title = LeaveApp.Utils.formatDate(date) + ' — ' + records.length + ' on leave';
        var body = records.map(function (r) {
            return '<div class="detail-row">' +
                '<span class="detail-label">' + LeaveApp.Utils.escapeHtml(r.employee) + '</span>' +
                '<span><span class="type-badge" data-type="' + LeaveApp.Utils.escapeHtml(r.type) + '">' +
                LeaveApp.Utils.escapeHtml(r.type) + '</span></span>' +
                '</div>';
        }).join('');
        LeaveApp.App.showModal(title, body);
    }

    return { init: init, render: render };
})();
