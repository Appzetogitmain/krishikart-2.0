/**
 * Exports data to a CSV file and triggers a download in the browser.
 * @param {string} filename - The name of the file (without extension).
 * @param {Array} columns - Array of objects with { header: string, key: string }
 * @param {Array} data - Array of objects containing the data
 */
export const exportToCSV = (filename, columns, data) => {
    if (!data || !data.length) return;

    const headers = columns.map(col => col.header).join(',');
    const rows = data.map(item => {
        return columns.map(col => {
            let val = item[col.key];

            // Handle nested objects/arrays if any
            if (typeof val === 'object' && val !== null) {
                val = JSON.stringify(val);
            }

            // Escape quotes and commas
            const stringVal = String(val ?? '');
            const escaped = stringVal.replace(/"/g, '""');
            return `"${escaped}"`;
        }).join(',');
    });

    // BOM so Excel opens the file as UTF-8 (₹ symbol, Hindi names)
    const csvContent = '﻿' + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
