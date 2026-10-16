/**
 * Exports data to a CSV file and triggers a download in the browser.
 * @param {string} filename - The name of the file (without extension).
 * @param {Array} columns - Array of objects with { header: string, key: string }
 * @param {Array} data - Array of objects containing the data
 * @param {Array} [extraSections] - More tables placed below the main one, separated by a blank
 *   row: [{ title, columns, data }]
 */
export const exportToCSV = (filename, columns, data, extraSections = []) => {
    if (!data || !data.length) return;

    const cell = (val) => {
        // Handle nested objects/arrays if any
        if (typeof val === 'object' && val !== null) {
            val = JSON.stringify(val);
        }
        // Escape quotes and commas
        return `"${String(val ?? '').replace(/"/g, '""')}"`;
    };
    const table = (cols, rowsData) => [
        cols.map(col => col.header).join(','),
        ...rowsData.map(item => cols.map(col => cell(item[col.key])).join(',')),
    ];

    const lines = table(columns, data);
    for (const section of extraSections) {
        if (!section?.data?.length) continue;
        lines.push('', cell(section.title), ...table(section.columns, section.data));
    }

    // BOM so Excel opens the file as UTF-8 (₹ symbol, Hindi names)
    const csvContent = '﻿' + lines.join('\n');
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
