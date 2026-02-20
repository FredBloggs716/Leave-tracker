var LeaveApp = LeaveApp || {};

LeaveApp.Utils = (function () {
    function parseDate(str) {
        if (!str) return null;
        str = str.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str + 'T00:00:00');
        var parts = str.split('/');
        if (parts.length === 3) {
            var a = parseInt(parts[0], 10);
            var b = parseInt(parts[1], 10);
            var c = parseInt(parts[2], 10);
            if (parts[2].length === 4) {
                if (a > 12) return new Date(c, b - 1, a); // DD/MM/YYYY
                if (b > 12) return new Date(c, a - 1, b); // MM/DD/YYYY
                return new Date(c, a - 1, b); // Assume MM/DD/YYYY (Google Sheets format)
            }
        }
        var d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }

    function businessDays(start, end) {
        var count = 0;
        var cur = new Date(start);
        cur.setHours(0, 0, 0, 0);
        var e = new Date(end);
        e.setHours(0, 0, 0, 0);
        while (cur <= e) {
            var dow = cur.getDay();
            if (dow !== 0 && dow !== 6) count++;
            cur.setDate(cur.getDate() + 1);
        }
        return count;
    }

    function formatDate(d) {
        if (!d) return '—';
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    }

    function monthName(i) {
        return ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'][i];
    }

    function sameDay(a, b) {
        return a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }

    function escapeHtml(str) {
        var el = document.createElement('span');
        el.textContent = str;
        return el.innerHTML;
    }

    // Get the current leave year period for an employee
    // startDay/startMonth are 1-indexed (e.g. 1, 4 = 1st April)
    // Returns { from: Date, to: Date }
    function getLeaveYear(startDay, startMonth) {
        var today = new Date();
        var year = today.getFullYear();
        // Leave year start this year
        var thisYearStart = new Date(year, startMonth - 1, startDay);
        thisYearStart.setHours(0, 0, 0, 0);

        if (today >= thisYearStart) {
            // We're in the leave year that started this calendar year
            var nextYearStart = new Date(year + 1, startMonth - 1, startDay);
            nextYearStart.setDate(nextYearStart.getDate() - 1);
            return { from: thisYearStart, to: nextYearStart };
        } else {
            // We're in the leave year that started last calendar year
            var lastYearStart = new Date(year - 1, startMonth - 1, startDay);
            lastYearStart.setHours(0, 0, 0, 0);
            var end = new Date(thisYearStart);
            end.setDate(end.getDate() - 1);
            return { from: lastYearStart, to: end };
        }
    }

    // Check if a leave record falls within a date range
    function isInRange(record, from, to) {
        return record.startDate >= from && record.startDate <= to;
    }

    return {
        parseDate: parseDate,
        businessDays: businessDays,
        formatDate: formatDate,
        monthName: monthName,
        sameDay: sameDay,
        escapeHtml: escapeHtml,
        getLeaveYear: getLeaveYear,
        isInRange: isInRange
    };
})();
