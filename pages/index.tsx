import React, { useEffect, useRef, useState, useContext } from 'react';
import { useRouter } from 'next/router';
import ProcedureLogModal from '../components/modals/ProcedureLogModal';
import NavBar from '../components/layout/NavBar';
import { useSession } from 'next-auth/react';
import { useTheme } from '../lib/theme/ThemeContext';
import { ColumnContext } from '../lib/columnContext';
import FilterBar from '../components/FilterBar';
import UserProfileSidebar from '../components/modals/UserProfileSidebar';
import { useAppSettings } from './_app';
import * as XLSX from 'xlsx';

const DATE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'last7' },
  { label: 'Current Month', value: 'currentMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Last 1 Year', value: 'lastYear' },
  { label: 'Custom', value: 'custom' },
];

type Physician = {
  physicianID: number;
  name: string;
  role: string;
  [key: string]: any;
};

function ProcedureLogPage() {
  const { data: session, status } = useSession();
  const { theme, setTheme, accentColor } = useTheme();
  const [procedures, setProcedures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchFields, setSearchFields] = useState(['patientID', 'patientName', 'diagnosis']);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalityFilter, setModalityFilter] = useState('');
  const [procedureNameFilter, setProcedureNameFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('currentMonth');
  const [customDateRange, setCustomDateRange] = useState({ from: '', to: '' });
  const [refPhysicianFilter, setRefPhysicianFilter] = useState('');
  const [doneByFilter, setDoneByFilter] = useState('');
  const [procedureNames, setProcedureNames] = useState<string[]>([]);
  const [modalities, setModalities] = useState(['USG', 'CT', 'OT', 'XF', 'DSA']);
  const [referringPhysicians, setReferringPhysicians] = useState<Physician[]>([]);
  const [irPhysicians, setIrPhysicians] = useState<Physician[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsData, setDetailsData] = useState<any>(null);
  const { columns, setColumns } = useContext(ColumnContext);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [scrollBarWidth, setScrollBarWidth] = useState(1200);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const [showUserProfileSidebar, setShowUserProfileSidebar] = useState(false);
  const columnPrefRef = useRef<HTMLDivElement>(null);
  const [scrollToColumnPrefs, setScrollToColumnPrefs] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('procedureDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currency, setCurrency] = useState('$');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [timeFormat, setTimeFormat] = useState('24hr');
  const { appHeading, appSubheading, appLogo } = useAppSettings();
  const navbarRef = useRef<HTMLDivElement>(null);
  const [navbarHeight, setNavbarHeight] = useState(0);

  function formatDate(dateStr: string) {
    if (!dateStr) return '';
    // Always parse as UTC and display only the date part
    const d = new Date(dateStr);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }

  function formatTime(timeStr: string) {
    if (!timeStr) return '';
    if (timeFormat === '12hr') {
      // Assume timeStr is HH:mm or HH:mm:ss
      const [h, m] = timeStr.split(':');
      let hour = parseInt(h, 10);
      const min = m;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12 || 12;
      return `${hour}:${min} ${ampm}`;
    }
    // Default: 24hr
    return timeStr;
  }

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.replace('/login');
      return;
    }
    fetchProcedures();
    fetchFilterOptions();
    fetchDropdownData();
    fetchCurrency();
    // eslint-disable-next-line
  }, [session, status]);

  useEffect(() => {
    if (showUserProfileSidebar) {
      setScrollToColumnPrefs(true);
    }
    // Only run when sidebar opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUserProfileSidebar]);

  useEffect(() => {
    let frame: number;
    let lastHeight = 0;
    let stableCount = 0;
    function measure() {
      if (navbarRef.current) {
        const h = navbarRef.current.offsetHeight;
        if (h !== lastHeight) {
          lastHeight = h;
          stableCount = 0;
          setNavbarHeight(h);
        } else {
          stableCount++;
        }
        if (stableCount < 3) {
          frame = requestAnimationFrame(measure);
        }
      }
    }
    function updateNavbarHeight() {
      lastHeight = 0;
      stableCount = 0;
      frame = requestAnimationFrame(measure);
    }
    updateNavbarHeight();
    window.addEventListener('resize', updateNavbarHeight);
    router.events?.on('routeChangeComplete', updateNavbarHeight);
    return () => {
      window.removeEventListener('resize', updateNavbarHeight);
      router.events?.off('routeChangeComplete', updateNavbarHeight);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [router.events]);

  // Re-measure navbar height after main content changes
  useEffect(() => {
    if (navbarRef.current) {
      let frame = requestAnimationFrame(() => {
        if (navbarRef.current) {
          setNavbarHeight(navbarRef.current.offsetHeight);
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [procedures.length, columns.length, loading]);

  const fetchProcedures = () => {
    fetch('/api/procedures')
      .then(async res => {
        if (res.status === 403 || res.status === 401) {
          router.replace('/login');
          return;
        }
        const data = await res.json();
        setProcedures(data);
        setLoading(false);
      })
      .catch(() => setError('Failed to load procedures'));
  };

  const fetchFilterOptions = () => {
    fetch('/api/procedures?list=true')
      .then(res => res.json())
      .then(data => {
        setProcedureNames(data.procedureNames || []);
      });
  };

  const fetchDropdownData = () => {
    fetch('/api/procedures/list-all')
      .then(res => res.json())
      .then((data: any[]) => setProcedureNames([...new Set(data.map((p: any) => p.procedureName))]));
    fetch('/api/physicians?role=Referrer')
      .then(res => res.json())
      .then(data => setReferringPhysicians(Array.isArray(data) ? data : []));
    fetch('/api/physicians?role=IR')
      .then(res => res.json())
      .then(data => setIrPhysicians(Array.isArray(data) ? data : []));
  };

  const fetchCurrency = () => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.currency) setCurrency(data.currency);
      });
  };

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.currency) setCurrency(data.currency);
        if (data.dateFormat) setDateFormat(data.dateFormat);
        if (data.timeFormat) setTimeFormat(data.timeFormat);
      });
  }, []);

  // For syncing the fixed scrollbar width and position
  useEffect(() => {
    function handleResize() {
      const bar = document.getElementById('horizontal-scroll');
      const container = containerRef.current;
      const table = tableRef.current;
      if (bar && container && table) {
        const rect = container.getBoundingClientRect();
        bar.style.width = rect.width + 'px';
        bar.style.left = rect.left + 'px';
        setScrollBarWidth(table.scrollWidth);
      }
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filtering logic
  const filtered = procedures.filter(p => {
    const search = searchText.trim().toLowerCase();
    if (search) {
      const matches = searchFields.some(field => {
        // Support notes and followUp fields
        let value = '';
        if (field === 'notes') value = (p.procedureNotesText || p.notes || '').toString().toLowerCase();
        else if (field === 'followUp') value = (p.followUp || '').toString().toLowerCase();
        else value = (p[field] || '').toString().toLowerCase();
        return value.includes(search);
      });
      if (!matches) return false;
    }
    if (statusFilter && p.status !== statusFilter) return false;
    if (modalityFilter && p.modality !== modalityFilter) return false;
    if (procedureNameFilter && !(p.procedureName || '').toLowerCase().includes(procedureNameFilter.toLowerCase())) return false;
    // Date filter logic
    if (dateFilter !== 'all') {
      // Parse procedure date as UTC date only (ignore time portion)
      const procedureDateStr = p.procedureDate?.split('T')[0]; // Get YYYY-MM-DD part
      if (!procedureDateStr) return false;
      const [year, month, day] = procedureDateStr.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));

      // Get today in UTC
      const now = new Date();
      const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

      let match = false;
      if (dateFilter === 'today') {
        match = date.getTime() === today.getTime();
      } else if (dateFilter === 'yesterday') {
        const yest = new Date(today);
        yest.setUTCDate(today.getUTCDate() - 1);
        match = date.getTime() === yest.getTime();
      } else if (dateFilter === 'last7' || dateFilter === 'week') {
        const d = new Date(today);
        d.setUTCDate(today.getUTCDate() - 6);
        match = date >= d && date <= today;
      } else if (dateFilter === 'currentMonth') {
        const from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
        match = date >= from && date <= today;
      } else if (dateFilter === 'lastMonth') {
        const from = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
        const to = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0)); // last day of previous month
        match = date >= from && date <= to;
      } else if (dateFilter === 'lastYear' || dateFilter === 'year') {
        const d = new Date(today);
        d.setUTCFullYear(today.getUTCFullYear() - 1);
        match = date >= d && date <= today;
      } else if (dateFilter === 'custom') {
        if (customDateRange.from && customDateRange.to) {
          const [fy, fm, fd] = customDateRange.from.split('-').map(Number);
          const [ty, tm, td] = customDateRange.to.split('-').map(Number);
          const from = new Date(Date.UTC(fy, fm - 1, fd));
          const to = new Date(Date.UTC(ty, tm - 1, td));
          match = date >= from && date <= to;
        } else {
          match = true;
        }
      }
      if (!match) return false;
    }
    if (refPhysicianFilter && p.refPhysician !== Number(refPhysicianFilter)) return false;
    if (doneByFilter && !(p.doneBy || []).some((d: any) => d.physicianID === Number(doneByFilter))) return false;
    return true;
  });

  // Sorting logic
  const sorted = [...filtered].sort((a, b) => {
    if (!sortColumn) return 0;
    let aValue = a[sortColumn];
    let bValue = b[sortColumn];
    // Special handling for nested fields
    if (sortColumn === 'procedureDate') {
      aValue = new Date(a.procedureDate);
      bValue = new Date(b.procedureDate);
    } else if (sortColumn === 'procedureTime') {
      aValue = a.procedureTime;
      bValue = b.procedureTime;
    } else if (sortColumn === 'patientName') {
      aValue = a.patientName?.toLowerCase() || '';
      bValue = b.patientName?.toLowerCase() || '';
    } else if (sortColumn === 'doneBy') {
      aValue = (a.doneBy?.map((d: any) => d.physician?.name).join(', ') || '').toLowerCase();
      bValue = (b.doneBy?.map((d: any) => d.physician?.name).join(', ') || '').toLowerCase();
    } else if (sortColumn === 'refPhysician') {
      aValue = a.refPhysicianObj?.name?.toLowerCase() || '';
      bValue = b.refPhysicianObj?.name?.toLowerCase() || '';
    } else if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    if (aValue == null) return 1;
    if (bValue == null) return -1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    return 0;
  });

  // Ensure scrollBarWidth is set after columns/data change and after mount, using setTimeout to wait for DOM paint
  useEffect(() => {
    const table = tableRef.current;
    if (table) {
      setTimeout(() => {
        setScrollBarWidth(table.scrollWidth);
      }, 0);
    }
  }, [columns, filtered, tableRef.current]);

  // Use ResizeObserver to update scrollBarWidth when table size changes
  useEffect(() => {
    const table = tableRef.current;
    if (!table || typeof ResizeObserver === 'undefined') return;
    function updateWidth() {
      if (table) setScrollBarWidth(table.scrollWidth);
    }
    updateWidth(); // Initial
    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(table);
    return () => observer.disconnect();
  }, [columns, filtered]);

  // Helper to clear all filters
  const clearAllFilters = () => {
    setSearchText('');
    setSearchFields(['patientID', 'patientName', 'diagnosis']);
    setStatusFilter('');
    setModalityFilter('');
    setProcedureNameFilter('');
    setDateFilter('currentMonth');
    setCustomDateRange({ from: '', to: '' });
    setRefPhysicianFilter('');
    setDoneByFilter('');
  };

  // Helper to clear individual filters
  const clearStatusFilter = () => setStatusFilter('');
  const clearModalityFilter = () => setModalityFilter('');
  const clearProcedureNameFilter = () => setProcedureNameFilter('');
  const clearDateFilter = () => { setDateFilter('all'); setCustomDateRange({ from: '', to: '' }); };
  const clearRefPhysicianFilter = () => setRefPhysicianFilter('');
  const clearDoneByFilter = () => setDoneByFilter('');

  const handleAdd = () => {
    setEditData(null);
    setShowModal(true);
  };

  const handleEdit = (row: any) => {
    setEditData({
      ...row,
      patientStatus: row.status || '',
      modality: row.modality || '',
      procedureRef: row.procedureID || '',
      doneBy: row.doneBy?.map((d: any) => d.physicianID) || [],
      refPhysician: row.refPhysician || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (procedureID: number) => {
    const res = await fetch(`/api/procedures/${procedureID}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setShowModal(false);
      setShowDetailsModal(false);
      fetchProcedures();
    } else {
      setError('Failed to delete');
    }
  };

  const handleSave = async (form: any) => {
    const isEdit = !!editData;
    const url = isEdit ? `/api/procedures/${editData.procedureID}` : '/api/procedures';
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowModal(false);
      fetchProcedures();
    } else {
      setError('Failed to save');
    }
  };

  const handleShowDetails = (row: any) => {
    setDetailsData({
      ...row,
      patientStatus: row.status || '',
      modality: row.modality || '',
      procedureRef: row.procedureID || '',
      doneBy: row.doneBy?.map((d: any) => d.physicianID) || [],
      refPhysician: row.refPhysician || '',
    });
    setShowDetailsModal(true);
  };

  const onToggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  // Export to Excel
  const handleExport = () => {
    // Only export visible columns
    const visibleColumns = columns.filter((col: any) => col.visible !== false);
    // Helper to extract text from React elements
    function extractText(val: any): string {
      if (val == null) return '';
      if (typeof val === 'string' || typeof val === 'number') return String(val);
      if (Array.isArray(val)) return val.map(extractText).join(' ');
      if (typeof val === 'object' && val.props && val.props.children) return extractText(val.props.children);
      return '';
    }
    const exportData = sorted.map(row => {
      const obj: any = {};
      visibleColumns.forEach((col: any) => {
        const renderFn = columnMap[col.key]?.render;
        const value = renderFn ? renderFn(row) : row[col.key];
        obj[columnMap[col.key]?.label || col.label || col.key] = extractText(value);
      });
      return obj;
    });
    // Prepare header rows
    const headerRows = [];
    headerRows.push([appHeading || '']);
    headerRows.push([appSubheading || '']);
    // Date range (always present)
    let dateRange = '';
    let from = '', to = '';
    const today = new Date();
    if (dateFilter === 'custom' && customDateRange.from && customDateRange.to) {
      from = customDateRange.from;
      to = customDateRange.to;
    } else if (dateFilter === 'today') {
      from = to = today.toISOString().slice(0, 10);
    } else if (dateFilter === 'yesterday') {
      const yest = new Date(today); yest.setDate(today.getDate() - 1);
      from = to = yest.toISOString().slice(0, 10);
    } else if (dateFilter === 'last7' || dateFilter === 'week') {
      const d = new Date(today); d.setDate(today.getDate() - 6);
      from = d.toISOString().slice(0, 10);
      to = today.toISOString().slice(0, 10);
    } else if (dateFilter === 'currentMonth') {
      from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      to = today.toISOString().slice(0, 10);
    } else if (dateFilter === 'lastMonth') {
      const fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const toDate = new Date(today.getFullYear(), today.getMonth(), 0);
      from = fromDate.toISOString().slice(0, 10);
      to = toDate.toISOString().slice(0, 10);
    } else if (dateFilter === 'lastYear' || dateFilter === 'year') {
      const d = new Date(today); d.setFullYear(today.getFullYear() - 1);
      from = d.toISOString().slice(0, 10);
      to = today.toISOString().slice(0, 10);
    }
    if (dateFilter === 'all' || (!from && !to)) {
      dateRange = 'Date Range: All dates';
    } else {
      dateRange = `Date Range: ${from} to ${to}`;
    }
    headerRows.push([dateRange]);
    // Add an empty row before table
    headerRows.push([]);
    // Table headers
    headerRows.push(visibleColumns.map((col: any) => columnMap[col.key]?.label || col.label || col.key));
    // Table data
    const dataRows = exportData.map(row => visibleColumns.map((col: any) => row[columnMap[col.key]?.label || col.label || col.key]));
    const aoa = [...headerRows, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Auto column widths
    const colCount = aoa[headerRows.length - 1]?.length || 0;
    const colWidths = Array(colCount).fill(0).map((_, colIdx) => {
      if (colIdx === 0) return { wch: 10 };
      let maxLen = 0;
      for (let row = 0; row < aoa.length; row++) {
        const cell = aoa[row][colIdx];
        const len = cell ? String(cell).length : 0;
        if (len > maxLen) maxLen = len;
      }
      return { wch: maxLen + 2 };
    });
    ws['!cols'] = colWidths;
    // Merge first three rows across all columns
    if (!ws['!merges']) ws['!merges'] = [];
    for (let i = 0; i < 3; i++) {
      ws['!merges'].push({ s: { r: i, c: 0 }, e: { r: i, c: colCount - 1 } });
    }
    // Apply bold styling to first three rows and table header row
    function setBold(ws: any, rowIdx: number, colCount: number) {
      for (let c = 0; c < colCount; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c });
        if (ws[cellRef]) {
          ws[cellRef].s = ws[cellRef].s || {};
          ws[cellRef].s = {
            font: { ...(ws[cellRef].s.font || {}), bold: true },
            alignment: { ...(ws[cellRef].s.alignment || {}), horizontal: 'center' },
          };
        }
      }
    }
    setBold(ws, 0, colCount); // App heading
    setBold(ws, 1, colCount); // App subheading
    setBold(ws, 2, colCount); // Date range
    setBold(ws, headerRows.length - 1, colCount); // Table header row
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ProcedureLogs');
    XLSX.writeFile(wb, 'procedure_logs.xlsx');
  };

  // Table column render helpers
  const columnMap: Record<string, { label: string; render: (p: any) => React.ReactNode }> = {
    patientID: { label: 'Patient ID', render: p => <span className="font-medium">{p.patientID}</span> },
    patientName: { label: 'Patient Name', render: p => p.patientName },
    patientAgeSex: { label: 'Age/Sex', render: p => `${p.patientAge}/${p.patientSex}` },
    patientStatus: {
      label: 'Status', render: p => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${p.status === 'IP' || p.status === 'Inpatient'
          ? 'bg-light-maroon text-dark-maroon'
          : p.status === 'OP' || p.status === 'Outpatient'
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
          }`}>
          {p.status}
        </span>
      )
    },
    modality: { label: 'Modality', render: p => p.modality },
    procedureName: { label: 'Procedure Name', render: p => <span className="font-medium" title={p.procedureName}>{p.procedureName}</span> },
    procedureDate: { label: 'Date', render: p => formatDate(p.procedureDate) },
    procedureTime: { label: 'Time', render: p => formatTime(p.procedureTime) },
    doneBy: { label: 'Done By', render: p => p.doneBy?.map((d: any) => d.physician?.name || '').join(', ') },
    refPhysician: { label: 'Referring Physician', render: p => p.refPhysicianObj?.name },
    diagnosis: { label: 'Diagnosis', render: p => <span className="max-w-xs truncate" title={p.diagnosis}>{p.diagnosis}</span> },
    procedureNotes: {
      label: 'Notes', render: p => {
        const notes = p.procedureNotesText || p.notes || '-';
        return <span className="max-w-xs truncate" title={notes}>{notes}</span>;
      }
    },
    notes: { label: 'Notes', render: p => p.notes },
    followUp: { label: 'Follow-up', render: p => <span title={p.followUp}>{p.followUp}</span> },
    procedureCost: { label: 'Cost', render: p => p.procedureCost != null && p.procedureCost !== '' ? `${currency}${p.procedureCost}` : '-' },
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading">
          <div className="spinner"></div>
          <span className="ml-4">Loading procedures...</span>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className={`min-h-screen bg-gray-50${theme === 'dark' ? ' dark' : ''}`}>
      <NavBar ref={navbarRef} user={session.user} onToggleTheme={onToggleTheme} theme={theme} appHeading={appHeading} appSubheading={appSubheading} appLogo={appLogo} />
      {/* Make the main content area a flex column that fills the viewport */}
      <div className="container flex flex-col" style={{ minHeight: 'calc(100vh - 64px)', paddingTop: navbarHeight + 8 }} ref={containerRef}>
        {/* Filter Card */}
        <div className="card mt-2 mb-4">
          <div className="card-body p-4">
            <FilterBar
              searchText={searchText}
              setSearchText={setSearchText}
              searchFields={searchFields}
              setSearchFields={setSearchFields}
              referringPhysicians={referringPhysicians}
              refPhysicianFilter={refPhysicianFilter}
              setRefPhysicianFilter={setRefPhysicianFilter}
              irPhysicians={irPhysicians}
              doneByFilter={doneByFilter}
              setDoneByFilter={setDoneByFilter}
              clearRefPhysicianFilter={clearRefPhysicianFilter}
              clearDoneByFilter={clearDoneByFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              modalityFilter={modalityFilter}
              setModalityFilter={setModalityFilter}
              procedureNameFilter={procedureNameFilter}
              setProcedureNameFilter={setProcedureNameFilter}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              customDateRange={customDateRange}
              setCustomDateRange={setCustomDateRange}
              procedureNames={procedureNames}
              modalities={modalities}
              accentColor={accentColor}
              clearStatusFilter={clearStatusFilter}
              clearModalityFilter={clearModalityFilter}
              clearProcedureNameFilter={clearProcedureNameFilter}
              clearDateFilter={clearDateFilter}
              clearAllFilters={clearAllFilters}
              dateFilters={DATE_FILTERS}
            />
          </div>
        </div>

        {/* Entry count and action buttons row */}
        <div className="flex justify-between items-center my-4">
          <div className="text-gray-500 text-sm ml-1">
            {`Showing ${filtered.length} of ${procedures.length} entries`}
          </div>
          <div className="flex gap-3">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowUserProfileSidebar(true);
                // setScrollToColumnPrefs(true); // REMOVE this line
              }}
            >
              Edit Columns
            </button>
            <button className="btn btn-secondary" onClick={handleExport}>Export</button>
            {(session.user && (session.user as any).permissions?.createProcedureLog) && (
              <button onClick={handleAdd} className="btn btn-primary">
                + New Registry Entry
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}

        {/* Table - make this card grow to fill available space */}
        <div className="card mt-4 flex-1 flex flex-col min-h-0">
          <div className="card-body p-0 flex-1 flex flex-col min-h-0">
            <div className="relative flex-1 flex flex-col min-h-0">
              {/* Table container with vertical scroll, fills available space */}
              <div
                className="overflow-y-auto flex-1 min-h-0"
                style={{ height: '100%', overflowX: 'auto' }}
                id="table-container"
                ref={tableContainerRef}
                onScroll={(e) => {
                  const target = e.target as HTMLElement;
                  const scrollBar = document.getElementById('horizontal-scroll');
                  if (scrollBar) {
                    scrollBar.scrollLeft = target.scrollLeft;
                  }
                }}
              >
                <table ref={tableRef} className="table" style={{ minWidth: 1200 }}>
                  <thead>
                    <tr>
                      {columns.filter((col: any) => col && col.visible).map((col: any) => (
                        <th
                          key={col.key}
                          style={{
                            cursor: 'pointer',
                            userSelect: 'none',
                            ...((col.key === 'procedureName' || col.key === 'procedureNotes' || col.key === 'doneBy' || col.key === 'diagnosis') && { maxWidth: 220 }),
                            ...(col.key === 'followUp' && { maxWidth: 180 }),
                            ...(col.key === 'patientID' && { maxWidth: 80 }),
                            ...(col.key === 'patientAgeSex' && { maxWidth: 60 }),
                            ...(col.key === 'modality' && { maxWidth: 80 }),
                            ...(col.key === 'patientStatus' && { maxWidth: 50 }),
                          }}
                          onClick={() => {
                            if (sortColumn === col.key) {
                              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortColumn(col.key);
                              setSortDirection('asc');
                            }
                          }}
                        >
                          {columnMap[col.key]?.label || col.label}
                          {sortColumn === col.key && (
                            <span style={{ marginLeft: 4, fontSize: 12 }}>
                              {sortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </th>
                      ))}
                      {/* Ghost column for robust spacing - always present */}
                      <th className="ghost-col" aria-hidden="true" key="ghost-header" style={{ minWidth: 200, width: 200, maxWidth: 200 }}></th>
                    </tr>
                  </thead>
                  <tbody ref={tbodyRef} style={{ position: 'relative' }}>
                    {sorted.map((p, rowIdx) => (
                      <tr
                        key={p.procedureID}
                        onClick={() => handleShowDetails(p)}
                        style={{ cursor: 'pointer' }}
                        className="hover:bg-accent-100 dark:hover:bg-accent-900 transition-colors"
                      >
                        {columns.filter((col: any) => col && col.visible).map((col: any) => (
                          <td
                            key={col.key}
                            style={{
                              ...((col.key === 'procedureName' || col.key === 'procedureNotes' || col.key === 'doneBy' || col.key === 'diagnosis') && { maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                              ...(col.key === 'followUp' && { maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                              ...(col.key === 'patientID' && { maxWidth: 80 }),
                              ...(col.key === 'patientAgeSex' && { maxWidth: 80 }),
                              ...((col.key === 'patientStatus' || col.key === 'modality') && { maxWidth: 60 }),
                            }}
                          >
                            {columnMap[col.key]?.render(p)}
                          </td>
                        ))}
                        {/* Ghost cell for robust spacing - always present */}
                        <td className="ghost-col" aria-hidden="true" key={`ghost-${p.procedureID}`} style={{ minWidth: 200, width: 200, maxWidth: 200 }}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No procedures found matching your criteria.
                </div>
              )}
            </div>
          </div>
        </div>

        <ProcedureLogModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          initialData={editData}
          viewOnly={false}
          onEdit={() => { }}
          userPermissions={session.user && (session.user as any).permissions}
          onDelete={(id: string) => handleDelete(Number(id))}
          navbarHeight={navbarHeight}
        />
        <ProcedureLogModal
          open={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          initialData={detailsData}
          onSave={() => setShowDetailsModal(false)}
          userPermissions={session.user && (session.user as any).permissions}
          viewOnly={true}
          onEdit={() => {
            setShowDetailsModal(false);
            setEditData(detailsData);
            setShowModal(true);
          }}
          onDelete={(id: string) => handleDelete(Number(id))}
          navbarHeight={navbarHeight}
        />
      </div>
      {/* Fixed horizontal scroll bar at bottom of viewport */}
      <div
        id="horizontal-scroll"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0, // will be set by JS
          width: '100vw', // will be set by JS
          background: 'var(--color-white)',
          borderTop: '1px solid var(--color-gray-200)',
          height: '16px',
          zIndex: 100,
          transition: 'left 0.2s, width 0.2s',
          pointerEvents: 'auto',
        }}
        className="overflow-x-auto"
        onScroll={(e) => {
          const target = e.target as HTMLElement;
          const tableContainer = document.getElementById('table-container');
          if (tableContainer && Math.abs(tableContainer.scrollLeft - target.scrollLeft) > 1) {
            tableContainer.scrollLeft = target.scrollLeft;
          }
        }}
      >
        <div style={{ width: scrollBarWidth, height: '1px' }}></div>
      </div>
      <UserProfileSidebar
        open={showUserProfileSidebar}
        onClose={() => setShowUserProfileSidebar(false)}
        scrollToColumnPrefs={scrollToColumnPrefs}
        setScrollToColumnPrefs={setScrollToColumnPrefs}
      />
    </div>
  );
}

export default ProcedureLogPage; 