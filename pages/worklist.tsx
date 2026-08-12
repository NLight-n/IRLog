import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import NavBar from '../components/layout/NavBar';
import * as XLSX from 'xlsx';
import { FiClock, FiPlus, FiEdit2, FiCheckCircle, FiXCircle, FiChevronLeft, FiChevronRight, FiSearch, FiSlash, FiRotateCcw, FiMoreVertical, FiCalendar, FiRefreshCw, FiDownload, FiPrinter } from 'react-icons/fi';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useAppSettings } from './_app';
import { useTheme } from '../lib/theme/ThemeContext';
import ProcedureLogModal from '../components/modals/ProcedureLogModal';
import { useAppointmentsCount } from '../lib/appointmentsCountContext';
import BottomSheetModal from '../components/common/BottomSheetModal';

type AppointmentItem = {
  id: number;
  patientID: string;
  patientName: string;
  patientAge?: number | null;
  patientSex?: string | null;
  procedureName: string;
  modality?: string | null;
  appointmentTime?: string | null;
  status: 'Scheduled' | 'Done' | 'NotDone' | 'Cancelled';
  notDoneReason?: string | null;
  displayOrder: number;
  dateScheduled?: string | null;
  notes?: string | null;
  dateAdded?: string | null;
};

type HolidayItem = {
  id: number;
  date: string;
  name: string;
  type: 'Festival' | 'Personal';
};

const PRESET_NOT_DONE_REASONS = [
  "Patient didn't show up",
  "Busy schedule",
  "Coagulation parameters deranged",
  "Hemodynamically unstable",
  "Patient refused procedure",
  "Equipment / Technical issue",
  "NPO status not maintained",
  "Other (specified below)"
];

const PRESET_CANCELLED_REASONS = [
  "Patient requested cancellation",
  "Referring physician cancelled",
  "Alternative treatment planned",
  "Procedure no longer indicated",
  "Financial / Insurance issues",
  "Other (specified below)"
];

const MODALITY_PRESETS = [
  { value: 'USG', label: 'USG - Ultrasound' },
  { value: 'CT', label: 'CT - Computed Tomography' },
  { value: 'DSA', label: 'DSA - Digital Subtraction Angiography' },
  { value: 'OT', label: 'OT - Operating Theater' },
  { value: 'XF', label: 'XF - X-ray Fluoroscopy' },
  { value: 'MRI', label: 'MRI - Magnetic Resonance Imaging' },
];

function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AppointmentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { appHeading, appSubheading, appLogo } = useAppSettings();
  const { theme, setTheme } = useTheme();
  const { refreshTodayCount } = useAppointmentsCount();

  const [items, setItems] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  // Procedures list loaded from backend for typable dropdown
  const [proceduresList, setProceduresList] = useState<any[]>([]);

  // Holidays state
  const [weeklyHoliday, setWeeklyHoliday] = useState<string>('Sunday');
  const [holidaysList, setHolidaysList] = useState<HolidayItem[]>([]);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState(formatDateKey(new Date()));
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayType, setNewHolidayType] = useState<'Festival' | 'Personal'>('Festival');

  // Caution prompt state for scheduling on a holiday
  const [pendingHolidayConfirm, setPendingHolidayConfirm] = useState<{
    type: 'drag' | 'submit';
    targetDateKey: string;
    formattedDate: string;
    holidayName: string;
    holidayType: string;
    dragResult?: DropResult;
  } | null>(null);

  // Date range state: startDate represents Day 0 of the 7-day view
  const [startDate, setStartDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  // Export Modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRangeOption, setExportRangeOption] = useState<'currentWeek' | 'all' | 'custom'>('currentWeek');
  const [exportCustomStartDate, setExportCustomStartDate] = useState(formatDateKey(new Date()));
  const [exportCustomEndDate, setExportCustomEndDate] = useState(formatDateKey(new Date()));
  const [exportStatusFilter, setExportStatusFilter] = useState<'ALL' | 'Done' | 'NotDone' | 'Cancelled' | 'Scheduled'>('ALL');

  // Search filter
  const [searchText, setSearchText] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Modals & Card Action Popover state
  const [showApptModal, setShowApptModal] = useState(false);
  const [apptModalMode, setApptModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<AppointmentItem | null>(null);
  const [actionCard, setActionCard] = useState<AppointmentItem | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const lastTapRef = useRef<{ id: number; time: number } | null>(null);

  const [formState, setFormState] = useState({
    patientID: '',
    patientName: '',
    patientAge: '',
    patientSex: '',
    procedureName: '',
    modality: '',
    appointmentTime: '',
    dateScheduled: formatDateKey(new Date()),
    notes: '',
  });

  // Typable dropdown states
  const [showProcedureDropdown, setShowProcedureDropdown] = useState(false);
  const [procedureDropdownIndex, setProcedureDropdownIndex] = useState(-1);
  const procedureDropdownRef = useRef<HTMLDivElement>(null);

  // Filtered procedures for keyboard & click selection
  const filteredProcedures = useMemo(() => {
    const query = (formState.procedureName || '').toLowerCase().trim();
    return proceduresList
      .filter(p => p.procedureName && p.procedureName.toLowerCase().includes(query))
      .slice(0, 30);
  }, [proceduresList, formState.procedureName]);

  // Not Done Reason Modal state
  const [showNotDoneModal, setShowNotDoneModal] = useState(false);
  const [notDoneItem, setNotDoneItem] = useState<AppointmentItem | null>(null);
  const [selectedReason, setSelectedReason] = useState(PRESET_NOT_DONE_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  // Cancelled Reason Modal state
  const [showCancelledModal, setShowCancelledModal] = useState(false);
  const [cancelledItem, setCancelledItem] = useState<AppointmentItem | null>(null);
  const [selectedCancelledReason, setSelectedCancelledReason] = useState(PRESET_CANCELLED_REASONS[0]);
  const [customCancelledReason, setCustomCancelledReason] = useState('');

  // IRLog Procedure Log Modal state
  const [showProcedureLogModal, setShowProcedureLogModal] = useState(false);
  const [procedureLogInitialData, setProcedureLogInitialData] = useState<any>(null);

  // Dynamic NavBar Height Measurement
  const navbarRef = useRef<HTMLDivElement>(null);
  const [navbarHeight, setNavbarHeight] = useState(0);

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

  // Load appointments and procedure list from API
  const loadAppointments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/worklist');
      if (!res.ok) throw new Error('Failed to load appointments');
      const data = await res.json();
      const mapped: AppointmentItem[] = (Array.isArray(data) ? data : []).map((p: any) => ({
        id: p.id,
        patientID: p.patientID || '',
        patientName: p.patientName || '',
        patientAge: p.patientAge ?? null,
        patientSex: p.patientSex ?? null,
        procedureName: p.procedureName || '',
        modality: p.modality || null,
        appointmentTime: p.appointmentTime || null,
        status: p.status || 'Scheduled',
        notDoneReason: p.notDoneReason || null,
        displayOrder: p.displayOrder ?? 0,
        dateScheduled: p.dateScheduled ? p.dateScheduled : null,
        notes: p.notes || null,
        dateAdded: p.dateAdded || null,
      }));
      setItems(mapped);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const loadHolidays = async () => {
    try {
      const res = await fetch('/api/holidays');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) setHolidaysList(list);
      }
    } catch (err) {
      console.error('Failed to fetch holidays:', err);
    }
  };

  const holidaysMap = useMemo(() => {
    const map: Record<string, HolidayItem> = {};
    holidaysList.forEach(h => {
      map[h.date] = h;
    });
    return map;
  }, [holidaysList]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.replace('/login');
      return;
    }
    const perms = (session.user as any)?.permissions || {};
    setCanEdit(!!perms.editProcedureLog);

    loadAppointments();
    loadHolidays();

    // Fetch settings for weekly holiday
    fetch('/api/settings')
      .then(r => r.json())
      .then(st => {
        if (st && st.weeklyHoliday) setWeeklyHoliday(st.weeklyHoliday);
      })
      .catch(() => { });

    // Fetch procedures list for typable dropdown
    fetch(`/api/procedures/list-all?_=${Date.now()}`)
      .then(r => r.json())
      .then(list => {
        if (Array.isArray(list)) setProceduresList(list);
      })
      .catch(() => { });
  }, [session, status, router]);

  // Click outside listener for typable procedure dropdown & search container
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (procedureDropdownRef.current && !procedureDropdownRef.current.contains(e.target as Node)) {
        setShowProcedureDropdown(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Patient ID Blur lookup handler
  const handlePatientIDBlur = async (patientID: string) => {
    const cleanId = patientID.trim();
    if (!cleanId) return;
    try {
      const res = await fetch(`/api/procedures/patient-lookup?patientID=${encodeURIComponent(cleanId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setFormState(prev => ({
            ...prev,
            patientName: data.patientName || prev.patientName || '',
            patientAge: data.patientAge !== undefined && data.patientAge !== null ? String(data.patientAge) : (prev.patientAge || ''),
            patientSex: data.patientSex || prev.patientSex || '',
          }));
        }
      }
    } catch (err) {
      console.error('Patient lookup failed:', err);
    }
  };

  // Helper to check if a date string YYYY-MM-DD is a specific or weekly holiday
  const getHolidayForDate = useCallback((dateKey: string): HolidayItem | undefined => {
    if (holidaysMap[dateKey]) return holidaysMap[dateKey];
    if (weeklyHoliday && weeklyHoliday !== 'None') {
      const d = new Date(`${dateKey}T00:00:00`);
      const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (dayNamesFull[d.getDay()] === weeklyHoliday) {
        return {
          id: -1,
          date: dateKey,
          name: `Weekly Holiday (${weeklyHoliday})`,
          type: 'Personal',
        };
      }
    }
    return undefined;
  }, [holidaysMap, weeklyHoliday]);

  // Generate 7 days columns starting with Yesterday (-1) as Column 1, Today (0) as Column 2
  const daysList = useMemo(() => {
    const days: { dateKey: string; dateObj: Date; dayName: string; formattedDate: string; isToday: boolean; isYesterday: boolean; holiday?: HolidayItem }[] = [];
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    const todayStr = formatDateKey(todayObj);

    const yesterdayObj = new Date(todayObj);
    yesterdayObj.setDate(todayObj.getDate() - 1);
    const yesterdayStr = formatDateKey(yesterdayObj);

    for (let i = -1; i <= 5; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      d.setHours(0, 0, 0, 0);

      const dateKey = formatDateKey(d);
      let dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      if (dateKey === yesterdayStr) {
        dayName = 'Yesterday';
      }

      const formattedDate = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

      days.push({
        dateKey,
        dateObj: d,
        dayName,
        formattedDate,
        isToday: dateKey === todayStr,
        isYesterday: dateKey === yesterdayStr,
        holiday: getHolidayForDate(dateKey),
      });
    }
    return days;
  }, [startDate, getHolidayForDate]);

  // Global search results across ALL appointments stored in database
  const globalSearchResults = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return [];
    return items.filter(it =>
      it.patientName.toLowerCase().includes(query) ||
      it.patientID.toLowerCase().includes(query) ||
      it.procedureName.toLowerCase().includes(query) ||
      (it.modality && it.modality.toLowerCase().includes(query)) ||
      (it.notDoneReason && it.notDoneReason.toLowerCase().includes(query)) ||
      (it.notes && it.notes.toLowerCase().includes(query))
    ).slice(0, 15);
  }, [items, searchText]);

  const handleSelectSearchResult = (item: AppointmentItem) => {
    if (item.dateScheduled) {
      const targetDate = new Date(item.dateScheduled);
      targetDate.setHours(0, 0, 0, 0);
      setStartDate(targetDate);
    }
    setActionCard(item);
    setShowSearchDropdown(false);
  };

  // Group items by dateKey YYYY-MM-DD
  const itemsByDay = useMemo(() => {
    const map: Record<string, AppointmentItem[]> = {};
    daysList.forEach(day => { map[day.dateKey] = []; });

    items.forEach(item => {
      let key = '';
      if (item.dateScheduled) {
        const d = new Date(item.dateScheduled);
        key = formatDateKey(d);
      }
      if (map[key]) {
        map[key].push(item);
      }
    });

    const getStatusRank = (status: string) => {
      if (status === 'Scheduled') return 0;
      if (status === 'NotDone') return 1;
      if (status === 'Done') return 2;
      if (status === 'Cancelled') return 3;
      return 4;
    };

    // Sort items within each day: Scheduled cases on top, Done/NotDone/Cancelled cases at the bottom
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => {
        const rankA = getStatusRank(a.status);
        const rankB = getStatusRank(b.status);
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      });
    });

    return map;
  }, [items, daysList]);

  // Dynamic grid template columns: Holiday columns with 0 items take 0.5fr width (50%), others take 1fr
  const gridTemplateColumns = useMemo(() => {
    return daysList.map(day => {
      const itemCount = (itemsByDay[day.dateKey] || []).length;
      const isSlimHoliday = !!day.holiday && itemCount === 0;
      return isSlimHoliday ? '0.5fr' : '1fr';
    }).join(' ');
  }, [daysList, itemsByDay]);

  // Date Navigation handlers
  const handlePrevWeek = () => {
    const next = new Date(startDate);
    next.setDate(startDate.getDate() - 7);
    setStartDate(next);
  };
  const handleNextWeek = () => {
    const next = new Date(startDate);
    next.setDate(startDate.getDate() + 7);
    setStartDate(next);
  };
  const handleGoToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setStartDate(today);
  };

  // Drag and Drop Execution
  const executeDrag = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const itemId = parseInt(draggableId.replace('appt-', ''), 10);
    const sourceDateKey = source.droppableId;
    const destDateKey = destination.droppableId;

    const newItems = [...items];
    const itemIndex = newItems.findIndex(it => it.id === itemId);
    if (itemIndex === -1) return;

    const targetItem = { ...newItems[itemIndex] };

    if (sourceDateKey !== destDateKey) {
      targetItem.dateScheduled = new Date(`${destDateKey}T00:00:00`).toISOString();
    }

    const destColumnItems = newItems
      .filter(it => {
        if (it.id === itemId) return false;
        const k = it.dateScheduled ? formatDateKey(new Date(it.dateScheduled)) : '';
        return k === destDateKey;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);

    destColumnItems.splice(destination.index, 0, targetItem);
    destColumnItems.forEach((it, idx) => {
      it.displayOrder = idx;
    });

    const updatedMap = new Map(destColumnItems.map(it => [it.id, it]));
    const finalItems = newItems.map(it => updatedMap.get(it.id) || (it.id === itemId ? targetItem : it));
    setItems(finalItems);

    try {
      await fetch(`/api/worklist/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateScheduled: targetItem.dateScheduled,
          displayOrder: destination.index,
        }),
      });

      destColumnItems.forEach((it, idx) => {
        if (it.id !== itemId) {
          fetch(`/api/worklist/${it.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayOrder: idx }),
          });
        }
      });
      refreshTodayCount();
    } catch (e) {
      console.error('Failed to update drag and drop changes', e);
    }
  };

  // Drag and Drop Handler with Holiday Caution Prompt
  const onDragEnd = async (result: DropResult) => {
    if (!canEdit) return;
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const destDateKey = destination.droppableId;
    const holiday = getHolidayForDate(destDateKey);
    if (holiday && source.droppableId !== destDateKey) {
      const targetDay = daysList.find(d => d.dateKey === destDateKey);
      setPendingHolidayConfirm({
        type: 'drag',
        targetDateKey: destDateKey,
        formattedDate: targetDay ? `${targetDay.dayName}, ${targetDay.formattedDate}` : destDateKey,
        holidayName: holiday.name,
        holidayType: holiday.type,
        dragResult: result,
      });
      return;
    }

    await executeDrag(result);
  };

  // Add & Edit Appointment Modals
  const openCreateModal = (defaultDateKey?: string) => {
    if (!canEdit) {
      alert('You need edit permissions to add appointments.');
      return;
    }
    setEditingItem(null);
    setFormState({
      patientID: '',
      patientName: '',
      patientAge: '',
      patientSex: '',
      procedureName: '',
      modality: '',
      appointmentTime: '',
      dateScheduled: defaultDateKey || formatDateKey(new Date()),
      notes: '',
    });
    setShowProcedureDropdown(false);
    setProcedureDropdownIndex(-1);
    setApptModalMode('create');
    setShowApptModal(true);
  };

  const openEditModal = (item: AppointmentItem) => {
    if (!canEdit) return;
    setEditingItem(item);
    setFormState({
      patientID: item.patientID,
      patientName: item.patientName,
      patientAge: item.patientAge != null ? String(item.patientAge) : '',
      patientSex: item.patientSex || '',
      procedureName: item.procedureName,
      modality: item.modality || '',
      appointmentTime: item.appointmentTime || '',
      dateScheduled: item.dateScheduled ? formatDateKey(new Date(item.dateScheduled)) : formatDateKey(new Date()),
      notes: item.notes || '',
    });
    setShowProcedureDropdown(false);
    setProcedureDropdownIndex(-1);
    setApptModalMode('edit');
    setShowApptModal(true);
  };

  const handleRefixAppointment = (item: AppointmentItem) => {
    if (!canEdit) return;
    setActionCard(null);
    setEditingItem(null);
    const origDateStr = item.dateScheduled ? formatDateKey(new Date(item.dateScheduled)) : '';
    setFormState({
      patientID: item.patientID,
      patientName: item.patientName,
      patientAge: item.patientAge != null ? String(item.patientAge) : '',
      patientSex: item.patientSex || '',
      procedureName: item.procedureName,
      modality: item.modality || '',
      appointmentTime: '',
      dateScheduled: formatDateKey(new Date()),
      notes: item.notes ? `[Refixed from ${origDateStr}] ${item.notes}` : `Refixed from ${origDateStr}`,
    });
    setShowProcedureDropdown(false);
    setProcedureDropdownIndex(-1);
    setApptModalMode('create');
    setShowApptModal(true);
  };

  const executeSaveAppointment = async () => {
    if (!canEdit) return;
    if (!formState.patientID || !formState.patientName || !formState.procedureName) return;

    const payload = {
      patientID: formState.patientID,
      patientName: formState.patientName,
      patientAge: formState.patientAge ? parseInt(formState.patientAge, 10) : null,
      patientSex: formState.patientSex || null,
      procedureName: formState.procedureName,
      modality: formState.modality || null,
      appointmentTime: formState.appointmentTime || null,
      dateScheduled: formState.dateScheduled ? new Date(`${formState.dateScheduled}T00:00:00`).toISOString() : new Date().toISOString(),
      notes: formState.notes || null,
      status: apptModalMode === 'edit' && editingItem ? editingItem.status : 'Scheduled',
    };

    if (apptModalMode === 'create') {
      const res = await fetch('/api/worklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setItems(prev => [created, ...prev]);
        setShowApptModal(false);
        refreshTodayCount();
      }
    } else if (apptModalMode === 'edit' && editingItem) {
      const res = await fetch(`/api/worklist/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems(prev => prev.map(it => it.id === updated.id ? updated : it));
        setShowApptModal(false);
        refreshTodayCount();
      }
    }
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!formState.patientID || !formState.patientName || !formState.procedureName) return;

    const holiday = getHolidayForDate(formState.dateScheduled);
    if (holiday && !pendingHolidayConfirm) {
      const targetDay = daysList.find(d => d.dateKey === formState.dateScheduled);
      setPendingHolidayConfirm({
        type: 'submit',
        targetDateKey: formState.dateScheduled,
        formattedDate: targetDay ? `${targetDay.dayName}, ${targetDay.formattedDate}` : formState.dateScheduled,
        holidayName: holiday.name,
        holidayType: holiday.type,
      });
      return;
    }

    await executeSaveAppointment();
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName) return;
    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newHolidayDate, name: newHolidayName, type: newHolidayType }),
      });
      if (res.ok) {
        setNewHolidayName('');
        loadHolidays();
      }
    } catch (err) {
      console.error('Failed to add holiday:', err);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    try {
      const res = await fetch(`/api/holidays?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadHolidays();
      }
    } catch (err) {
      console.error('Failed to delete holiday:', err);
    }
  };

  // Export Data Handlers
  const getExportItems = () => {
    let filtered = [...items];

    if (exportRangeOption === 'currentWeek') {
      const weekKeys = new Set(daysList.map(d => d.dateKey));
      filtered = filtered.filter(it => {
        if (!it.dateScheduled) return false;
        const k = formatDateKey(new Date(it.dateScheduled));
        return weekKeys.has(k);
      });
    } else if (exportRangeOption === 'custom') {
      filtered = filtered.filter(it => {
        if (!it.dateScheduled) return false;
        const k = formatDateKey(new Date(it.dateScheduled));
        return k >= exportCustomStartDate && k <= exportCustomEndDate;
      });
    }

    if (exportStatusFilter !== 'ALL') {
      filtered = filtered.filter(it => it.status === exportStatusFilter);
    }

    filtered.sort((a, b) => {
      const da = a.dateScheduled ? new Date(a.dateScheduled).getTime() : 0;
      const db = b.dateScheduled ? new Date(b.dateScheduled).getTime() : 0;
      return da - db;
    });

    return filtered;
  };

  const handleExportExcel = () => {
    const exportData = getExportItems();
    if (exportData.length === 0) {
      alert('No appointment records found matching the selected filter.');
      return;
    }

    const rows = exportData.map(item => ({
      'Date Scheduled': item.dateScheduled ? formatDateKey(new Date(item.dateScheduled)) : '',
      'Patient ID': item.patientID,
      'Patient Name': item.patientName,
      'Age': item.patientAge ?? '',
      'Sex': item.patientSex ?? '',
      'Procedure Name': item.procedureName,
      'Modality': item.modality ?? '',
      'Status': item.status === 'NotDone' ? 'Not Done' : item.status,
      'Reason (Not Done / Cancelled)': item.notDoneReason ?? '',
      'Notes': item.notes ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    ws['!cols'] = [
      { wch: 14 },
      { wch: 14 },
      { wch: 22 },
      { wch: 6 },
      { wch: 6 },
      { wch: 25 },
      { wch: 10 },
      { wch: 12 },
      { wch: 32 },
      { wch: 30 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Appointments_Audit');

    const dateStr = formatDateKey(new Date());
    XLSX.writeFile(wb, `IRLog_Appointments_Export_${dateStr}.xlsx`);
    setShowExportModal(false);
  };

  const handleExportPDF = () => {
    const exportData = getExportItems();
    if (exportData.length === 0) {
      alert('No appointment records found matching the selected filter.');
      return;
    }

    const notDoneReasonsCount: Record<string, number> = {};
    const cancelledReasonsCount: Record<string, number> = {};
    let doneCount = 0;
    let notDoneCount = 0;
    let cancelledCount = 0;
    let scheduledCount = 0;

    exportData.forEach(it => {
      if (it.status === 'Done') doneCount++;
      else if (it.status === 'NotDone') {
        notDoneCount++;
        const reason = it.notDoneReason || 'Unspecified';
        notDoneReasonsCount[reason] = (notDoneReasonsCount[reason] || 0) + 1;
      } else if (it.status === 'Cancelled') {
        cancelledCount++;
        const reason = it.notDoneReason || 'Unspecified';
        cancelledReasonsCount[reason] = (cancelledReasonsCount[reason] || 0) + 1;
      } else {
        scheduledCount++;
      }
    });

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popups to export printable PDF report.');
      return;
    }

    const dateTodayStr = new Date().toLocaleDateString('en-US', { dateStyle: 'full' });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>IRLog Appointments & Status Audit Report</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1e293b; background: #fff; }
          h1 { font-size: 22px; color: #0f172a; margin-bottom: 4px; margin-top: 0; }
          .subtitle { font-size: 13px; color: #64748b; margin-bottom: 20px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .card { padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; }
          .card-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
          .card-value { font-size: 22px; font-weight: 800; }
          .done { color: #16a34a; }
          .notdone { color: #d97706; }
          .cancelled { color: #dc2626; }
          .scheduled { color: #2563eb; }
          
          .breakdown-box { margin-bottom: 20px; padding: 12px 16px; border-radius: 8px; background: #fffbebf; border: 1px solid #fef3c7; font-size: 13px; }
          .breakdown-box h3 { margin: 0 0 8px 0; font-size: 14px; color: #92400e; }
          .breakdown-list { margin: 0; padding-left: 20px; }
          .breakdown-list li { margin-bottom: 4px; }

          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background: #f1f5f9; font-weight: 700; color: #334155; }
          tr:nth-child(even) { background: #f8fafc; }
          .badge { font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 4px; display: inline-block; }
          .badge-done { background: #dcfce7; color: #15803d; }
          .badge-notdone { background: #fef3c7; color: #92400e; }
          .badge-cancelled { background: #fee2e2; color: #b91c1c; }
          .badge-scheduled { background: #dbeafe; color: #1e40af; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
          <div>
            <h1>IRLog Appointments & Procedure Audit Report</h1>
            <div class="subtitle">Generated on ${dateTodayStr} | Total Filtered Records: ${exportData.length}</div>
          </div>
          <button class="no-print" onclick="window.print()" style="padding:8px 16px; background:#2563eb; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;">Print / Save as PDF</button>
        </div>

        <div class="summary-grid">
          <div class="card"><div class="card-title">Completed (Done)</div><div class="card-value done">${doneCount}</div></div>
          <div class="card"><div class="card-title">Not Done</div><div class="card-value notdone">${notDoneCount}</div></div>
          <div class="card"><div class="card-title">Cancelled</div><div class="card-value cancelled">${cancelledCount}</div></div>
          <div class="card"><div class="card-title">Scheduled</div><div class="card-value scheduled">${scheduledCount}</div></div>
        </div>

        ${notDoneCount > 0 ? `
          <div class="breakdown-box">
            <h3>⚠️ Not Done Reasons Breakdown:</h3>
            <ul class="breakdown-list">
              ${Object.entries(notDoneReasonsCount).map(([reason, cnt]) => `<li><strong>${reason}:</strong> ${cnt} case(s)</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${cancelledCount > 0 ? `
          <div class="breakdown-box" style="background:#fef2f2; border-color:#fecaca;">
            <h3 style="color:#b91c1c;">🚫 Cancellation Reasons Breakdown:</h3>
            <ul class="breakdown-list">
              ${Object.entries(cancelledReasonsCount).map(([reason, cnt]) => `<li><strong>${reason}:</strong> ${cnt} case(s)</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th>Date Scheduled</th>
              <th>Patient ID</th>
              <th>Patient Name</th>
              <th>Age/Sex</th>
              <th>Procedure Name</th>
              <th>Modality</th>
              <th>Status</th>
              <th>Reason (Not Done / Cancelled)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${exportData.map(item => {
      const stClass = item.status === 'Done' ? 'badge-done' : item.status === 'NotDone' ? 'badge-notdone' : item.status === 'Cancelled' ? 'badge-cancelled' : 'badge-scheduled';
      const stLabel = item.status === 'NotDone' ? 'Not Done' : item.status;
      const dateStr = item.dateScheduled ? formatDateKey(new Date(item.dateScheduled)) : '-';
      return `
                <tr>
                  <td>${dateStr}</td>
                  <td><strong>${item.patientID}</strong></td>
                  <td>${item.patientName}</td>
                  <td>${item.patientAge ?? ''}/${item.patientSex ?? ''}</td>
                  <td>${item.procedureName}</td>
                  <td>${item.modality || '-'}</td>
                  <td><span class="badge ${stClass}">${stLabel}</span></td>
                  <td style="color:${item.status === 'Cancelled' ? '#b91c1c' : '#92400e'}">${item.notDoneReason || '-'}</td>
                  <td>${item.notes || '-'}</td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
    setShowExportModal(false);
  };

  const handleDeleteAppointment = async (id: number) => {
    if (!canEdit) return;
    if (!confirm('Are you sure you want to delete this appointment?')) return;
    const res = await fetch(`/api/worklist/${id}`, { method: 'DELETE' });
    if (res.status === 204 || res.ok) {
      setItems(prev => prev.filter(it => it.id !== id));
      setShowApptModal(false);
      refreshTodayCount();
    }
  };

  // Status Action Handlers: Done / Not Done / Cancelled
  const handleMarkDone = async (item: AppointmentItem) => {
    if (!canEdit) return;

    // Update status to Done in state and DB
    const res = await fetch(`/api/worklist/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Done', dateDone: new Date().toISOString() }),
    });

    if (res.ok) {
      const updated = await res.json();
      setItems(prev => prev.map(it => it.id === updated.id ? updated : it));
      refreshTodayCount();

      // Prompt user whether to create an IRLog Register entry
      if (window.confirm(`Do you want to create an IRLog Register entry for ${item.patientName}?`)) {
        const initialData = {
          patientID: item.patientID,
          patientName: item.patientName,
          patientAge: item.patientAge ? String(item.patientAge) : '',
          patientSex: item.patientSex || '',
          procedureName: item.procedureName,
          modality: item.modality || '',
          procedureDate: item.dateScheduled ? formatDateKey(new Date(item.dateScheduled)) : formatDateKey(new Date()),
          procedureTime: item.appointmentTime || new Date().toTimeString().slice(0, 5),
        };
        setProcedureLogInitialData(initialData);
        setShowProcedureLogModal(true);
      }
    }
  };

  const handleOpenNotDoneModal = (item: AppointmentItem) => {
    if (!canEdit) return;
    setNotDoneItem(item);
    setSelectedReason(PRESET_NOT_DONE_REASONS[0]);
    setCustomReason('');
    setShowNotDoneModal(true);
  };

  const handleConfirmNotDone = async () => {
    if (!notDoneItem || !canEdit) return;
    const reason = selectedReason === 'Other (specified below)' ? customReason.trim() : selectedReason;
    if (!reason) {
      alert('Please specify a reason.');
      return;
    }

    const res = await fetch(`/api/worklist/${notDoneItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'NotDone', notDoneReason: reason }),
    });

    if (res.ok) {
      const updated = await res.json();
      setItems(prev => prev.map(it => it.id === updated.id ? updated : it));
      setShowNotDoneModal(false);
      setNotDoneItem(null);
      refreshTodayCount();
    }
  };

  const handleOpenCancelledModal = (item: AppointmentItem) => {
    if (!canEdit) return;
    setCancelledItem(item);
    setSelectedCancelledReason(PRESET_CANCELLED_REASONS[0]);
    setCustomCancelledReason('');
    setShowCancelledModal(true);
  };

  const handleConfirmCancelled = async () => {
    if (!cancelledItem || !canEdit) return;
    const reason = selectedCancelledReason === 'Other (specified below)' ? customCancelledReason.trim() : selectedCancelledReason;
    if (!reason) {
      alert('Please specify a reason.');
      return;
    }

    const res = await fetch(`/api/worklist/${cancelledItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Cancelled', notDoneReason: reason }),
    });

    if (res.ok) {
      const updated = await res.json();
      setItems(prev => prev.map(it => it.id === updated.id ? updated : it));
      setShowCancelledModal(false);
      setCancelledItem(null);
      setActionCard(null);
      refreshTodayCount();
    }
  };

  const handleResetToScheduled = async (item: AppointmentItem) => {
    if (!canEdit) return;
    const res = await fetch(`/api/worklist/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Scheduled', notDoneReason: null }),
    });

    if (res.ok) {
      const updated = await res.json();
      setItems(prev => prev.map(it => it.id === updated.id ? updated : it));
      setActionCard(null);
      refreshTodayCount();
    }
  };

  const handleSaveProcedureLog = async (form: any) => {
    const res = await fetch('/api/procedures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowProcedureLogModal(false);
    } else {
      alert('Failed to save procedure log');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div>
        <NavBar ref={navbarRef} user={session?.user} onToggleTheme={setTheme} theme={theme} appHeading={appHeading} appSubheading={appSubheading} appLogo={appLogo} />
        <div style={{ paddingTop: (navbarHeight || 64) + 24, paddingInline: 16, textAlign: 'center', color: 'var(--color-gray-600)' }}>
          Loading appointments schedule...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-gray-50)', color: 'var(--color-gray-900)', display: 'flex', flexDirection: 'column' }}>
      <NavBar ref={navbarRef} user={session?.user} onToggleTheme={setTheme} theme={theme} appHeading={appHeading} appSubheading={appSubheading} appLogo={appLogo} />

      <div className="page-content-mobile" style={{ paddingTop: (navbarHeight || 64) + 12, paddingInline: 16, paddingBottom: 80, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Worklist Header & Controls */}
        <div className="worklist-header-wrapper">

          {/* Row 1: Title & 7-Day View Tag */}
          <div className="worklist-header-title-row">
            <h2 className="worklist-title" style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--color-gray-900)' }}>Procedure Appointments</h2>
            <span style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-contrast, #fff)',
              borderRadius: 20,
              padding: '2px 10px',
              fontSize: 13,
              fontWeight: 700,
            }}>
              7-Day View
            </span>
          </div>

          {/* Row 2: Controls Container */}
          <div className="worklist-controls-row">

            {/* Left Controls: Navigation, Date Picker, Search Box (Row 3 on mobile) */}
            <div className="worklist-left-controls">
              {/* Prev / Today / Next */}
              <div className="date-nav-group" style={{ display: 'flex', alignItems: 'center', background: 'var(--color-white)', border: '1px solid var(--color-gray-300)', borderRadius: 8, padding: '2px 6px' }}>
                <button
                  onClick={handlePrevWeek}
                  title="Previous 7 Days"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', color: 'var(--color-gray-700)' }}
                >
                  <FiChevronLeft size={18} />
                </button>
                <button
                  onClick={handleGoToday}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                    padding: '4px 10px',
                    color: 'var(--color-accent)',
                  }}
                >
                  Today
                </button>
                <button
                  onClick={handleNextWeek}
                  title="Next 7 Days"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', color: 'var(--color-gray-700)' }}
                >
                  <FiChevronRight size={18} />
                </button>
              </div>

              {/* Jump to Date Picker */}
              <input
                type="date"
                value={formatDateKey(startDate)}
                onChange={(e) => {
                  if (e.target.value) {
                    setStartDate(new Date(`${e.target.value}T00:00:00`));
                  }
                }}
                style={{
                  padding: '6px 10px',
                  border: '1px solid var(--color-gray-300)',
                  borderRadius: 8,
                  fontSize: 13,
                  background: 'var(--color-white)',
                  color: 'var(--color-gray-900)'
                }}
              />

              {/* Search Input with Global Dropdown */}
              <div ref={searchContainerRef} className="search-input-wrapper" style={{ position: 'relative' }}>
                <FiSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }} />
                <input
                  type="text"
                  placeholder="Search all appointments..."
                  value={searchText}
                  onFocus={() => setShowSearchDropdown(true)}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  style={{
                    padding: '6px 12px 6px 32px',
                    border: '1px solid var(--color-gray-300)',
                    borderRadius: 8,
                    fontSize: 13,
                    width: 230,
                    background: 'var(--color-white)',
                    color: 'var(--color-gray-900)'
                  }}
                />

                {/* Global Search Results Dropdown Popup */}
                {showSearchDropdown && searchText.trim().length > 0 && (
                  <div className="search-dropdown-popup">
                    {globalSearchResults.length === 0 ? (
                      <div style={{ padding: 14, fontSize: 13, color: 'var(--color-gray-500)', textAlign: 'center' }}>
                        No matching appointments found.
                      </div>
                    ) : (
                      <div>
                        <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-gray-500)', borderBottom: '1px solid var(--color-gray-200)', background: 'var(--color-gray-50)' }}>
                          Search Results ({globalSearchResults.length})
                        </div>
                        {globalSearchResults.map((item) => {
                          const dateStr = item.dateScheduled ? new Date(item.dateScheduled).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Unscheduled';
                          const isDone = item.status === 'Done';
                          const isNotDone = item.status === 'NotDone';
                          const isCancelled = item.status === 'Cancelled';
                          const statusLabel = isDone ? 'Done' : isNotDone ? 'Not Done' : isCancelled ? 'Cancelled' : 'Scheduled';
                          const statusBg = isDone ? '#dcfce7' : isNotDone ? '#fef3c7' : isCancelled ? '#fee2e2' : '#dbeafe';
                          const statusColor = isDone ? '#15803d' : isNotDone ? '#92400e' : isCancelled ? '#b91c1c' : '#1e40af';

                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelectSearchResult(item)}
                              style={{
                                padding: '10px 14px',
                                borderBottom: '1px solid var(--color-gray-100)',
                                cursor: 'pointer',
                                transition: 'background 0.15s ease',
                              }}
                              className="hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-gray-900)' }}>{item.patientName}</div>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: statusBg, color: statusColor }}>
                                  {statusLabel}
                                </span>
                              </div>

                              <div style={{ fontSize: 11, color: 'var(--color-gray-600)', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ fontWeight: 600 }}>ID: {item.patientID}</span>
                                {(item.patientAge != null || item.patientSex) && (
                                  <span>• {item.patientAge != null ? `${item.patientAge}Y` : ''}{item.patientSex ? `/${item.patientSex}` : ''}</span>
                                )}
                              </div>

                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{item.procedureName} {item.modality ? `[${item.modality}]` : ''}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-gray-600)', background: 'var(--color-gray-100)', padding: '1px 6px', borderRadius: 4 }}>📅 {dateStr}</span>
                              </div>

                              {item.notDoneReason && (
                                <div style={{ fontSize: 11, color: isCancelled ? '#b91c1c' : '#92400e', fontStyle: 'italic', marginTop: 3 }}>
                                  Reason: {item.notDoneReason}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons Group */}
            <div className="worklist-action-buttons">
              <button
                onClick={() => setShowExportModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--color-gray-100)',
                  color: 'var(--color-gray-900)',
                  border: '1px solid var(--color-gray-300)',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <FiDownload size={15} /> Export Audit
              </button>

              {canEdit && (
                <button
                  onClick={() => setShowHolidayModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--color-gray-100)',
                    color: 'var(--color-gray-900)',
                    border: '1px solid var(--color-gray-300)',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  🌴 Holiday List
                </button>
              )}

              {canEdit && (
                <button
                  onClick={() => openCreateModal()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--color-accent)',
                    color: 'var(--color-accent-contrast, #fff)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <FiPlus size={16} /> Add Appointment
                </button>
              )}
            </div>

          </div>
        </div>

        {/* 7-Day Horizontal Equal Grid */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ overflowX: 'auto', paddingBottom: 8, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: gridTemplateColumns,
              gap: 12,
              minWidth: 'max(1120px, 100%)',
              flex: 1,
              minHeight: 520,
              alignItems: 'stretch',
              transition: 'grid-template-columns 0.3s ease',
            }}>
              {daysList.map((day) => {
                const dayItems = itemsByDay[day.dateKey] || [];
                return (
                  <Droppable droppableId={day.dateKey} key={day.dateKey} isDropDisabled={!canEdit}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{
                          position: 'relative',
                          overflow: 'hidden',
                          background: snapshot.isDraggingOver
                            ? 'var(--color-drag-over-bg, #dbeafe)'
                            : day.holiday
                              ? (day.holiday.type === 'Festival' ? 'rgba(245, 158, 11, 0.06)' : 'rgba(14, 165, 233, 0.06)')
                              : day.isToday
                                ? 'var(--color-today-bg, #eff6ff)'
                                : 'var(--color-gray-100)',
                          border: day.holiday
                            ? (day.holiday.type === 'Festival' ? '2px dashed #f59e0b' : '2px dashed #0284c7')
                            : day.isToday
                              ? '2px solid var(--color-accent)'
                              : '1px solid var(--color-gray-200)',
                          borderRadius: 10,
                          padding: 10,
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'background-color 0.2s',
                          boxShadow: day.isToday ? '0 2px 8px rgba(59,130,246,0.15)' : 'none',
                        }}
                      >
                        {/* Vertical Background Watermark for Holiday */}
                        {day.holiday && (
                          <div style={{
                            position: 'absolute',
                            top: 55,
                            bottom: 10,
                            left: 0,
                            right: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                            overflow: 'hidden',
                            zIndex: 0,
                          }}>
                            <div style={{
                              writingMode: 'vertical-rl',
                              fontSize: 14,
                              fontWeight: 800,
                              letterSpacing: 2,
                              textTransform: 'uppercase',
                              color: day.holiday.type === 'Festival' ? '#d97706' : '#0284c7',
                              opacity: 0.5,
                              userSelect: 'none',
                              whiteSpace: 'nowrap',
                            }}>
                              {day.holiday.type === 'Festival' ? '🎉 ' : '🌴 '}{day.holiday.name}
                            </div>
                          </div>
                        )}

                        {/* Day Column Header */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 10,
                          paddingBottom: 8,
                          borderBottom: '1px solid var(--color-gray-200)',
                          position: 'relative',
                          zIndex: 1,
                        }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: day.isToday ? 'var(--color-accent)' : 'var(--color-gray-800)' }}>
                              {day.dayName} {day.isToday && <span style={{ fontSize: 10, background: 'var(--color-accent)', color: '#fff', borderRadius: 4, padding: '1px 4px', marginLeft: 4 }}>Today</span>}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-gray-900)', marginTop: 2 }}>
                              {day.formattedDate}
                            </div>
                          </div>
                          <span style={{
                            background: day.isToday ? 'var(--color-accent)' : 'var(--color-gray-200)',
                            color: day.isToday ? '#fff' : 'var(--color-gray-700)',
                            borderRadius: '50%',
                            width: 22,
                            height: 22,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                          }}>
                            {dayItems.length}
                          </span>
                        </div>

                        {/* Add Button inside column */}
                        {canEdit && (
                          <button
                            onClick={() => openCreateModal(day.dateKey)}
                            title={`Add appointment on ${day.formattedDate}`}
                            style={{
                              position: 'relative',
                              zIndex: 1,
                              width: '100%',
                              padding: '6px',
                              marginBottom: 8,
                              border: '1px dashed var(--color-gray-300)',
                              background: 'var(--color-white)',
                              color: 'var(--color-gray-600)',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                            }}
                          >
                            <FiPlus size={14} /> Add
                          </button>
                        )}

                        {/* List of Appointment Cards */}
                        <div style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
                          {dayItems.map((item, idx) => {
                            const isDone = item.status === 'Done';
                            const isNotDone = item.status === 'NotDone';
                            const isCancelled = item.status === 'Cancelled';
                            const isExpanded = expandedCardId === item.id;
                            const hasReason = !!(item.notDoneReason && (isNotDone || isCancelled));

                            return (
                              <Draggable draggableId={`appt-${item.id}`} index={idx} key={item.id} isDragDisabled={!canEdit || item.status !== 'Scheduled'}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    className="appt-card"
                                    onMouseEnter={() => setExpandedCardId(item.id)}
                                    onMouseLeave={() => setExpandedCardId(null)}
                                    onTouchEnd={(e) => {
                                      const now = Date.now();
                                      const lastTap = lastTapRef.current;
                                      if (lastTap && lastTap.id === item.id && (now - lastTap.time) < 350) {
                                        // Double tap → open action card
                                        e.preventDefault();
                                        lastTapRef.current = null;
                                        setExpandedCardId(null);
                                        setActionCard(item);
                                      } else {
                                        // Single tap → toggle expand
                                        lastTapRef.current = { id: item.id, time: now };
                                        setExpandedCardId(prev => prev === item.id ? null : item.id);
                                      }
                                    }}
                                    onClick={(e) => {
                                      // Desktop: only open action card if not using touch
                                      if ('ontouchstart' in window) {
                                        e.preventDefault();
                                        return;
                                      }
                                      setActionCard(item);
                                    }}
                                    style={{
                                      userSelect: 'none',
                                      padding: 8,
                                      marginBottom: 8,
                                      background: 'var(--color-white)',
                                      border: isDone
                                        ? '1px solid #22c55e'
                                        : isNotDone
                                          ? '1px solid #f59e0b'
                                          : isCancelled
                                            ? '1px solid #ef4444'
                                            : '1px solid var(--color-gray-300)',
                                      borderRadius: 8,
                                      cursor: 'pointer',
                                      boxShadow: dragSnapshot.isDragging
                                        ? '0 8px 16px rgba(0,0,0,0.15)'
                                        : isExpanded
                                          ? '0 4px 12px rgba(0,0,0,0.12)'
                                          : '0 1px 3px rgba(0,0,0,0.05)',
                                      opacity: isCancelled ? 0.65 : 1,
                                      transition: 'box-shadow 0.2s ease, transform 0.15s ease',
                                      position: 'relative',
                                      zIndex: isExpanded ? 5 : 'auto',
                                      ...dragProvided.draggableProps.style,
                                    }}
                                  >
                                    {/* Row 1: Patient Name (truncated) & Status Badge */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 2 }}>
                                      <div style={{
                                        fontWeight: 700,
                                        fontSize: 13,
                                        color: 'var(--color-gray-900)',
                                        flex: 1,
                                        minWidth: 0,
                                        ...(isExpanded
                                          ? { wordBreak: 'break-word' as const }
                                          : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }),
                                      }}>
                                        {item.patientName}
                                      </div>
                                      <span style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                        background: isDone
                                          ? '#dcfce7'
                                          : isNotDone
                                            ? '#fef3c7'
                                            : isCancelled
                                              ? '#fee2e2'
                                              : '#dbeafe',
                                        color: isDone
                                          ? '#15803d'
                                          : isNotDone
                                            ? '#92400e'
                                            : isCancelled
                                              ? '#b91c1c'
                                              : '#1e40af',
                                      }}>
                                        {item.status === 'NotDone' ? 'Not Done' : item.status}
                                      </span>
                                    </div>

                                    {/* Row 2: ID & Age / Sex */}
                                    <div style={{ fontSize: 11, color: 'var(--color-gray-600)', marginBottom: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
                                      <span style={{ fontWeight: 600 }}>ID: {item.patientID}</span>
                                      {(item.patientAge != null || item.patientSex) && (
                                        <span>• {item.patientAge != null ? `${item.patientAge}Y` : ''}{item.patientSex ? `/${item.patientSex}` : ''}</span>
                                      )}
                                    </div>

                                    {/* Row 3: [Modality] + Procedure (truncated) */}
                                    <div style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: 'var(--color-accent)',
                                      marginBottom: hasReason ? 2 : 0,
                                      minWidth: 0,
                                      ...(isExpanded
                                        ? { wordBreak: 'break-word' as const }
                                        : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }),
                                    }}>
                                      {item.modality ? `[${item.modality}] ` : ''}{item.procedureName}
                                    </div>

                                    {/* Row 4 (conditional): Reason for Cancelled/NotDone — truncated when collapsed */}
                                    {hasReason && (
                                      <div style={{
                                        fontSize: 10,
                                        color: isCancelled ? '#b91c1c' : '#92400e',
                                        fontStyle: 'italic',
                                        marginTop: 2,
                                        ...(isExpanded
                                          ? { wordBreak: 'break-word' as const }
                                          : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }),
                                      }} title={item.notDoneReason || ''}>
                                        Reason: {item.notDoneReason}
                                      </div>
                                    )}

                                    {/* Expanded details: shown on hover / tap */}
                                    {isExpanded && (
                                      <div className="appt-card-expanded" style={{
                                        marginTop: 6,
                                        paddingTop: 6,
                                        borderTop: '1px dashed var(--color-gray-300)',
                                        fontSize: 11,
                                        color: 'var(--color-gray-600)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 3,
                                      }}>
                                        {item.appointmentTime && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <FiClock size={11} /> <span>Time: {item.appointmentTime}</span>
                                          </div>
                                        )}
                                        {item.notes && (
                                          <div style={{ display: 'flex', gap: 4 }}>
                                            <span style={{ fontWeight: 600, flexShrink: 0 }}>Notes:</span>
                                            <span style={{ wordBreak: 'break-word' }}>{item.notes}</span>
                                          </div>
                                        )}
                                        {item.dateAdded && (
                                          <div style={{ fontSize: 10, color: 'var(--color-gray-400)' }}>
                                            Added: {new Date(item.dateAdded).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </div>
        </DragDropContext>
      </div>

      {/* Add / Edit Appointment Modal */}
      <BottomSheetModal
        open={showApptModal}
        onClose={() => setShowApptModal(false)}
        title={apptModalMode === 'create' ? 'Schedule New Appointment' : 'Edit Appointment Details'}
        maxWidth="560px"
      >
        <div>
          <form onSubmit={handleSaveAppointment} className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>

            {/* Patient ID with Auto-Lookup on Blur */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Patient ID *</span>
              <input
                required
                placeholder="Enter or type Patient ID"
                value={formState.patientID}
                onChange={(e) => setFormState({ ...formState, patientID: e.target.value })}
                onBlur={(e) => handlePatientIDBlur(e.target.value)}
                style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
              />
            </label>

            {/* Patient Name */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Patient Name *</span>
              <input
                required
                placeholder="Patient Full Name"
                value={formState.patientName}
                onChange={(e) => setFormState({ ...formState, patientName: e.target.value })}
                style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
              />
            </label>

            {/* Patient Age (No Up/Down Arrow Spinners) */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Age</span>
              <input
                type="number"
                className="no-spinner"
                placeholder="e.g. 45"
                value={formState.patientAge}
                onChange={(e) => setFormState({ ...formState, patientAge: e.target.value })}
                style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
              />
            </label>

            {/* Patient Sex */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Sex</span>
              <select
                value={formState.patientSex}
                onChange={(e) => setFormState({ ...formState, patientSex: e.target.value })}
                style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
              >
                <option value="">Select Sex</option>
                <option value="M">Male (M)</option>
                <option value="F">Female (F)</option>
                <option value="Other">Other</option>
              </select>
            </label>

            {/* Typable Dropdown with Keyboard Navigation: Procedure Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1', position: 'relative' }} ref={procedureDropdownRef}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Procedure Name *</span>
              <input
                required
                placeholder="Type to search or select procedure..."
                value={formState.procedureName}
                onFocus={() => {
                  setShowProcedureDropdown(true);
                  setProcedureDropdownIndex(0);
                }}
                onChange={(e) => {
                  setFormState({ ...formState, procedureName: e.target.value });
                  setShowProcedureDropdown(true);
                  setProcedureDropdownIndex(0);
                }}
                onKeyDown={(e) => {
                  if (!showProcedureDropdown || filteredProcedures.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setProcedureDropdownIndex(prev => Math.min(prev + 1, filteredProcedures.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setProcedureDropdownIndex(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter') {
                    if (procedureDropdownIndex >= 0 && filteredProcedures[procedureDropdownIndex]) {
                      e.preventDefault();
                      const selected = filteredProcedures[procedureDropdownIndex].procedureName;
                      setFormState(prev => ({ ...prev, procedureName: selected }));
                      setShowProcedureDropdown(false);
                      setProcedureDropdownIndex(-1);
                    }
                  } else if (e.key === 'Escape' || e.key === 'Tab') {
                    setShowProcedureDropdown(false);
                    setProcedureDropdownIndex(-1);
                  }
                }}
                style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
              />
              {showProcedureDropdown && filteredProcedures.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: 180,
                  overflowY: 'auto',
                  background: 'var(--color-white)',
                  border: '1px solid var(--color-gray-300)',
                  borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 10001,
                  marginTop: 2,
                }}>
                  {filteredProcedures.map((p, idx) => {
                    const isHighlighted = procedureDropdownIndex === idx;
                    return (
                      <div
                        key={p.proID || p.procedureName}
                        onClick={() => {
                          setFormState(prev => ({ ...prev, procedureName: p.procedureName }));
                          setShowProcedureDropdown(false);
                          setProcedureDropdownIndex(-1);
                        }}
                        onMouseEnter={() => setProcedureDropdownIndex(idx)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: 13,
                          background: isHighlighted ? 'var(--color-accent)' : 'transparent',
                          color: isHighlighted ? '#fff' : 'var(--color-gray-900)',
                          borderBottom: '1px solid var(--color-gray-100)',
                        }}
                      >
                        {p.procedureName}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modality Dropdown Field */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Modality</span>
              <select
                value={formState.modality || ''}
                onChange={(e) => setFormState({ ...formState, modality: e.target.value })}
                style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
              >
                <option value="">Select Modality</option>
                {MODALITY_PRESETS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>

            {/* Appointment Time */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Appointment Time (Optional)</span>
              <input
                type="time"
                value={formState.appointmentTime}
                onChange={(e) => setFormState({ ...formState, appointmentTime: e.target.value })}
                style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
              />
            </label>

            {/* Date Scheduled */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Date Scheduled</span>
              <input
                type="date"
                required
                value={formState.dateScheduled}
                onChange={(e) => setFormState({ ...formState, dateScheduled: e.target.value })}
                style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
              />
            </label>

            {/* Notes */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Notes (Optional)</span>
              <textarea
                rows={2}
                value={formState.notes}
                onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)', resize: 'vertical' }}
              />
            </label>

            {/* Actions Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gridColumn: '1 / -1', marginTop: 8 }}>
              <div>
                {apptModalMode === 'edit' && editingItem && canEdit && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAppointment(editingItem.id)}
                    style={{ padding: '8px 14px', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, background: 'var(--color-white)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowApptModal(false)}
                  style={{ padding: '8px 14px', border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-gray-100)', color: 'var(--color-gray-900)', cursor: 'pointer', fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', border: 'none', background: 'var(--color-accent)', color: '#fff', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                >
                  {apptModalMode === 'edit' ? 'Save Changes' : 'Schedule Appointment'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </BottomSheetModal>

      {/* Mark Not Done Reason Modal */}
      <BottomSheetModal
        open={showNotDoneModal && !!notDoneItem}
        onClose={() => setShowNotDoneModal(false)}
        title="Mark Procedure as Not Done"
        maxWidth="450px"
      >
        <p style={{ fontSize: 13, color: 'var(--color-gray-600)', marginBottom: 14 }}>
          Select or specify the reason why the procedure for <strong>{notDoneItem?.patientName}</strong> was not performed:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {PRESET_NOT_DONE_REASONS.map(reason => (
            <label key={reason} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--color-gray-800)' }}>
              <input
                type="radio"
                name="notDoneReason"
                value={reason}
                checked={selectedReason === reason}
                onChange={() => setSelectedReason(reason)}
              />
              {reason}
            </label>
          ))}
        </div>

        {selectedReason === 'Other (specified below)' && (
          <textarea
            placeholder="Enter specific reason..."
            rows={2}
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            style={{ width: '100%', padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, marginBottom: 14, fontSize: 13, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowNotDoneModal(false)}
            style={{ padding: '8px 14px', border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-gray-100)', color: 'var(--color-gray-900)', cursor: 'pointer', fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmNotDone}
            style={{ padding: '8px 16px', border: 'none', background: '#dc2626', color: '#fff', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
          >
            Confirm Not Done
          </button>
        </div>
      </BottomSheetModal>

      {/* Action Card Context Popover Modal */}
      <BottomSheetModal
        open={!!actionCard}
        onClose={() => setActionCard(null)}
        title={actionCard?.patientName || ''}
        maxWidth="460px"
      >
        {actionCard && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-gray-500)', marginTop: 2 }}>
                  ID: {actionCard.patientID} {actionCard.patientAge ? `| ${actionCard.patientAge}Y` : ''} {actionCard.patientSex ? `/${actionCard.patientSex}` : ''}
                </div>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: 6,
                background: actionCard.status === 'Done' ? '#dcfce7' : actionCard.status === 'NotDone' ? '#fef3c7' : actionCard.status === 'Cancelled' ? '#fee2e2' : '#dbeafe',
                color: actionCard.status === 'Done' ? '#15803d' : actionCard.status === 'NotDone' ? '#92400e' : actionCard.status === 'Cancelled' ? '#b91c1c' : '#1e40af',
              }}>
                {actionCard.status === 'NotDone' ? 'Not Done' : actionCard.status}
              </span>
            </div>

            <div style={{ background: 'var(--color-gray-100)', padding: 10, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-accent)' }}>
                {actionCard.procedureName} {actionCard.modality ? `(${actionCard.modality})` : ''}
              </div>
              {actionCard.appointmentTime && (
                <div style={{ fontSize: 12, color: 'var(--color-gray-600)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FiClock size={12} /> Scheduled Time: {actionCard.appointmentTime}
                </div>
              )}
              {actionCard.notDoneReason && (
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4, fontStyle: 'italic' }}>
                  Reason: {actionCard.notDoneReason}
                </div>
              )}
            </div>

            {/* Action Buttons List */}
            {canEdit && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => { setActionCard(null); openEditModal(actionCard); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-gray-300)', background: 'var(--color-white)', color: 'var(--color-gray-900)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  <FiEdit2 size={16} /> Edit Details
                </button>

                <button
                  onClick={() => { setActionCard(null); handleMarkDone(actionCard); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, border: 'none', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  <FiCheckCircle size={16} /> Mark as Done
                </button>

                <button
                  onClick={() => { setActionCard(null); handleOpenNotDoneModal(actionCard); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, border: 'none', background: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  <FiXCircle size={16} /> Mark as Not Done
                </button>

                <button
                  onClick={() => { setActionCard(null); handleOpenCancelledModal(actionCard); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#b91c1c', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  <FiSlash size={16} /> Mark as Cancelled
                </button>

                {(actionCard.status === 'NotDone' || actionCard.status === 'Cancelled') && (
                  <button
                    onClick={() => handleRefixAppointment(actionCard)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--color-accent)',
                      color: 'var(--color-accent-contrast, #fff)',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    <FiRefreshCw size={16} /> Refix Appointment (Copy to Today)
                  </button>
                )}

                {actionCard.status !== 'Scheduled' && (
                  <button
                    onClick={() => { handleResetToScheduled(actionCard); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-gray-300)', background: 'var(--color-gray-100)', color: 'var(--color-gray-900)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                  >
                    <FiRotateCcw size={16} /> Reset Status to Scheduled
                  </button>
                )}
              </div>
            )}

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setActionCard(null)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--color-gray-300)', background: 'var(--color-gray-100)', color: 'var(--color-gray-900)', cursor: 'pointer', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </>
        )}
      </BottomSheetModal>

      {/* Mark Cancelled Reason Modal */}
      <BottomSheetModal
        open={showCancelledModal && !!cancelledItem}
        onClose={() => setShowCancelledModal(false)}
        title="Mark Appointment as Cancelled"
        maxWidth="450px"
      >
        <p style={{ fontSize: 13, color: 'var(--color-gray-600)', marginBottom: 14 }}>
          Select or specify the cancellation reason for <strong>{cancelledItem?.patientName}</strong>:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {PRESET_CANCELLED_REASONS.map(reason => (
            <label key={reason} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--color-gray-800)' }}>
              <input
                type="radio"
                name="cancelledReason"
                value={reason}
                checked={selectedCancelledReason === reason}
                onChange={() => setSelectedCancelledReason(reason)}
              />
              {reason}
            </label>
          ))}
        </div>

        {selectedCancelledReason === 'Other (specified below)' && (
          <textarea
            placeholder="Enter specific cancellation reason..."
            rows={2}
            value={customCancelledReason}
            onChange={(e) => setCustomCancelledReason(e.target.value)}
            style={{ width: '100%', padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, marginBottom: 14, fontSize: 13, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowCancelledModal(false)}
            style={{ padding: '8px 14px', border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-gray-100)', color: 'var(--color-gray-900)', cursor: 'pointer', fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmCancelled}
            style={{ padding: '8px 16px', border: 'none', background: '#dc2626', color: '#fff', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
          >
            Confirm Cancelled
          </button>
        </div>
      </BottomSheetModal>

      {/* Holiday Caution Confirmation Prompt Modal */}
      <BottomSheetModal
        open={!!pendingHolidayConfirm}
        onClose={() => setPendingHolidayConfirm(null)}
        title="⚠️ Holiday Caution"
        maxWidth="440px"
      >
        {pendingHolidayConfirm && (
          <>
            <p style={{ fontSize: 14, color: 'var(--color-gray-800)', lineHeight: 1.5, marginBottom: 18 }}>
              <strong>{pendingHolidayConfirm.formattedDate}</strong> is marked as a <strong>{pendingHolidayConfirm.holidayType} Holiday</strong> (<em>{pendingHolidayConfirm.holidayName}</em>).
              <br /><br />
              Do you still want to book an appointment on this day?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setPendingHolidayConfirm(null)}
                style={{ padding: '8px 16px', border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-gray-100)', color: 'var(--color-gray-900)', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const confirmData = pendingHolidayConfirm;
                  setPendingHolidayConfirm(null);
                  if (confirmData.type === 'drag' && confirmData.dragResult) {
                    await executeDrag(confirmData.dragResult);
                  } else if (confirmData.type === 'submit') {
                    await executeSaveAppointment();
                  }
                }}
                style={{ padding: '8px 18px', border: 'none', background: '#f59e0b', color: '#fff', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm & Proceed
              </button>
            </div>
          </>
        )}
      </BottomSheetModal>

      {/* Manage Holiday List Modal */}
      <BottomSheetModal
        open={showHolidayModal}
        onClose={() => setShowHolidayModal(false)}
        title="Manage Holiday List"
        maxWidth="580px"
      >
        <p style={{ fontSize: 13, color: 'var(--color-gray-600)', marginBottom: 14 }}>
          Set your recurring weekly off day or add specific Festival and Personal holidays. Holiday dates are automatically highlighted with caution prompts during scheduling.
        </p>

        {/* Weekly Off Day Setting */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--color-gray-100)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-gray-900)' }}>Weekly Recurring Off Day</div>
            <div style={{ fontSize: 11, color: 'var(--color-gray-600)' }}>Standard weekly holiday for your clinic/department</div>
          </div>
          <select
            value={weeklyHoliday}
            onChange={(e) => {
              const val = e.target.value;
              setWeeklyHoliday(val);
              fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weeklyHoliday: val }),
              });
            }}
            style={{ padding: '6px 12px', border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)', fontSize: 13, fontWeight: 600 }}
          >
            <option value="Sunday">Sunday (Default)</option>
            <option value="Friday">Friday</option>
            <option value="Saturday">Saturday</option>
            <option value="Monday">Monday</option>
            <option value="Tuesday">Tuesday</option>
            <option value="Wednesday">Wednesday</option>
            <option value="Thursday">Thursday</option>
            <option value="None">None</option>
          </select>
        </div>

        {/* Add Holiday Form */}
        <form onSubmit={handleAddHoliday} className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, alignItems: 'end', marginBottom: 18, background: 'var(--color-gray-100)', padding: 12, borderRadius: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Date *</span>
            <input
              type="date"
              required
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              style={{ padding: 6, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)', fontSize: 13 }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Holiday Name *</span>
            <input
              required
              placeholder="e.g. Diwali, Leave"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              style={{ padding: 6, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)', fontSize: 13 }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Type</span>
            <select
              value={newHolidayType}
              onChange={(e) => setNewHolidayType(e.target.value as any)}
              style={{ padding: 6, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)', fontSize: 13 }}
            >
              <option value="Festival">🎉 Festival</option>
              <option value="Personal">🌴 Personal</option>
            </select>
          </label>

          <button
            type="submit"
            style={{ padding: '7px 14px', border: 'none', background: 'var(--color-accent)', color: '#fff', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            + Add
          </button>
        </form>

        {/* Existing Holidays List */}
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--color-gray-200)', borderRadius: 8 }}>
          {holidaysList.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-gray-500)', fontSize: 13 }}>
              No custom holidays added yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--color-gray-100)', textAlign: 'left', borderBottom: '1px solid var(--color-gray-200)' }}>
                  <th style={{ padding: '8px 12px' }}>Date</th>
                  <th style={{ padding: '8px 12px' }}>Holiday Name</th>
                  <th style={{ padding: '8px 12px' }}>Type</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {holidaysList.map(h => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--color-gray-100)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{h.date}</td>
                    <td style={{ padding: '8px 12px' }}>{h.name}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: h.type === 'Festival' ? '#fef3c7' : '#e0f2fe', color: h.type === 'Festival' ? '#b45309' : '#0369a1' }}>
                        {h.type === 'Festival' ? '🎉 Festival' : '🌴 Personal'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteHoliday(h.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button
            onClick={() => setShowHolidayModal(false)}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--color-gray-300)', background: 'var(--color-gray-100)', color: 'var(--color-gray-900)', cursor: 'pointer', fontWeight: 600 }}
          >
            Close
          </button>
        </div>
      </BottomSheetModal>
      {/* Export Options Modal */}
      <BottomSheetModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        title={<><FiDownload size={20} color="var(--color-accent)" style={{ display: 'inline', marginRight: 8 }} />Export Audit & Appointments</>}
        maxWidth="500px"
      >
        <p style={{ fontSize: 13, color: 'var(--color-gray-600)', marginBottom: 16 }}>
          Export detailed appointment tracking records including completed status, non-completion reasons, and cancellation feedback.
        </p>

        {/* Date Range Selection */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--color-gray-800)' }}>Date Range</label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportRange"
                value="currentWeek"
                checked={exportRangeOption === 'currentWeek'}
                onChange={() => setExportRangeOption('currentWeek')}
              />
              Current 7-Day View
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportRange"
                value="all"
                checked={exportRangeOption === 'all'}
                onChange={() => setExportRangeOption('all')}
              />
              All Records
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportRange"
                value="custom"
                checked={exportRangeOption === 'custom'}
                onChange={() => setExportRangeOption('custom')}
              />
              Custom Date Range
            </label>
          </div>

          {exportRangeOption === 'custom' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--color-gray-100)', padding: 10, borderRadius: 8 }}>
              <label style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>From:
                <input
                  type="date"
                  value={exportCustomStartDate}
                  onChange={(e) => setExportCustomStartDate(e.target.value)}
                  style={{ width: '100%', marginTop: 4, padding: 6, border: '1px solid var(--color-gray-300)', borderRadius: 6, fontSize: 13, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
                />
              </label>
              <label style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>To:
                <input
                  type="date"
                  value={exportCustomEndDate}
                  onChange={(e) => setExportCustomEndDate(e.target.value)}
                  style={{ width: '100%', marginTop: 4, padding: 6, border: '1px solid var(--color-gray-300)', borderRadius: 6, fontSize: 13, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
                />
              </label>
            </div>
          )}
        </div>

        {/* Status Filter */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--color-gray-800)' }}>Status Filter</label>
          <select
            value={exportStatusFilter}
            onChange={(e) => setExportStatusFilter(e.target.value as any)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-gray-300)', borderRadius: 8, fontSize: 13, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
          >
            <option value="ALL">All Statuses (Done, Not Done, Cancelled, Scheduled)</option>
            <option value="NotDone">⚠️ Not Done Only (with Reasons)</option>
            <option value="Cancelled">🚫 Cancelled Only (with Reasons)</option>
            <option value="Done">✅ Done / Completed Only</option>
            <option value="Scheduled">🔵 Scheduled Only</option>
          </select>
        </div>

        {/* Export Format Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid var(--color-gray-200)', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowExportModal(false)}
            style={{ padding: '8px 14px', border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-gray-100)', color: 'var(--color-gray-900)', cursor: 'pointer', fontWeight: 500 }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', background: '#16a34a', color: '#fff', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
          >
            <FiDownload size={16} /> Excel (.xlsx)
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', background: '#2563eb', color: '#fff', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
          >
            <FiPrinter size={16} /> PDF / Print Report
          </button>
        </div>
      </BottomSheetModal>


      {/* IRLog Register Modal */}
      <ProcedureLogModal
        open={showProcedureLogModal}
        onClose={() => setShowProcedureLogModal(false)}
        onSave={handleSaveProcedureLog}
        initialData={procedureLogInitialData}
        userPermissions={(session?.user as any)?.permissions}
        onDelete={() => { }}
        viewOnly={false}
        onEdit={() => { }}
        navbarHeight={0}
      />
    </div>
  );
}

