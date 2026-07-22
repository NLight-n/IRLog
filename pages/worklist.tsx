import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import NavBar from '../components/layout/NavBar';
import { FiClock, FiPlus, FiEdit2, FiCheckCircle, FiXCircle, FiChevronLeft, FiChevronRight, FiSearch, FiSlash, FiRotateCcw, FiMoreVertical } from 'react-icons/fi';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useAppSettings } from './_app';
import { useTheme } from '../lib/theme/ThemeContext';
import ProcedureLogModal from '../components/modals/ProcedureLogModal';

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

  // Search filter
  const [searchText, setSearchText] = useState('');

  // Modals & Card Action Popover state
  const [showApptModal, setShowApptModal] = useState(false);
  const [apptModalMode, setApptModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<AppointmentItem | null>(null);
  const [actionCard, setActionCard] = useState<AppointmentItem | null>(null);

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
      .catch(() => {});

    // Fetch procedures list for typable dropdown
    fetch(`/api/procedures/list-all?_=${Date.now()}`)
      .then(r => r.json())
      .then(list => {
        if (Array.isArray(list)) setProceduresList(list);
      })
      .catch(() => {});
  }, [session, status, router]);

  // Click outside listener for typable procedure dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (procedureDropdownRef.current && !procedureDropdownRef.current.contains(e.target as Node)) {
        setShowProcedureDropdown(false);
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
      if (dateKey === todayStr) {
        dayName = 'Today';
      } else if (dateKey === yesterdayStr) {
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

  // Filter items by search
  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return items;
    return items.filter(it =>
      it.patientName.toLowerCase().includes(query) ||
      it.patientID.toLowerCase().includes(query) ||
      it.procedureName.toLowerCase().includes(query) ||
      (it.modality && it.modality.toLowerCase().includes(query))
    );
  }, [items, searchText]);

  // Group items by dateKey YYYY-MM-DD
  const itemsByDay = useMemo(() => {
    const map: Record<string, AppointmentItem[]> = {};
    daysList.forEach(day => { map[day.dateKey] = []; });

    filteredItems.forEach(item => {
      let key = '';
      if (item.dateScheduled) {
        const d = new Date(item.dateScheduled);
        key = formatDateKey(d);
      }
      if (map[key]) {
        map[key].push(item);
      }
    });

    // Sort items within each day by displayOrder
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    });

    return map;
  }, [filteredItems, daysList]);

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
      status: 'Scheduled',
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
      }
    } else if (apptModalMode === 'edit' && editingItem) {
      const res = await fetch(`/api/worklist/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems(prev => prev.map(it => it.id === updated.id ? updated : it));
        setShowApptModal(false);
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

  const handleDeleteAppointment = async (id: number) => {
    if (!canEdit) return;
    if (!confirm('Are you sure you want to delete this appointment?')) return;
    const res = await fetch(`/api/worklist/${id}`, { method: 'DELETE' });
    if (res.status === 204 || res.ok) {
      setItems(prev => prev.filter(it => it.id !== id));
      setShowApptModal(false);
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
        <NavBar user={session?.user} onToggleTheme={setTheme} theme={theme} appHeading={appHeading} appSubheading={appSubheading} appLogo={appLogo} />
        <div style={{ paddingTop: 96, paddingInline: 16, textAlign: 'center', color: 'var(--color-gray-600)' }}>
          Loading appointments schedule...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-gray-50)', color: 'var(--color-gray-900)', display: 'flex', flexDirection: 'column' }}>
      <NavBar user={session?.user} onToggleTheme={setTheme} theme={theme} appHeading={appHeading} appSubheading={appSubheading} appLogo={appLogo} />

      <div style={{ paddingTop: 80, paddingInline: 16, paddingBottom: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Header & Controls Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--color-gray-900)' }}>Procedure Appointments</h2>
            <span style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-contrast, #fff)',
              borderRadius: 20,
              padding: '2px 10px',
              fontSize: 14,
              fontWeight: 700,
            }}>
              7-Day View
            </span>
          </div>

          {/* Date Navigation & Actions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-white)', border: '1px solid var(--color-gray-300)', borderRadius: 8, padding: '2px 6px' }}>
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

            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }} />
              <input
                type="text"
                placeholder="Search patient, ID, procedure..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{
                  padding: '6px 12px 6px 32px',
                  border: '1px solid var(--color-gray-300)',
                  borderRadius: 8,
                  fontSize: 13,
                  width: 220,
                  background: 'var(--color-white)',
                  color: 'var(--color-gray-900)'
                }}
              />
            </div>

            {/* Holiday List Button */}
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
                }}
              >
                🌴 Holiday List
              </button>
            )}

            {/* Add New Appointment Button */}
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
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <FiPlus size={16} /> Add Appointment
              </button>
            )}
          </div>
        </div>

        {/* 7-Day Horizontal Equal Grid */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ overflowX: 'auto', paddingBottom: 8, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 12,
              minWidth: 780,
              flex: 1,
              minHeight: 520,
              alignItems: 'stretch'
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
                        background: snapshot.isDraggingOver
                          ? 'var(--color-drag-over-bg, #dbeafe)'
                          : day.holiday
                          ? (day.holiday.type === 'Festival' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(14, 165, 233, 0.08)')
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
                      {/* Day Column Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 10,
                        paddingBottom: 8,
                        borderBottom: '1px solid var(--color-gray-200)'
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: day.isToday ? 'var(--color-accent)' : 'var(--color-gray-800)' }}>
                            {day.dayName} {day.isToday && <span style={{ fontSize: 10, background: 'var(--color-accent)', color: '#fff', borderRadius: 4, padding: '1px 4px', marginLeft: 4 }}>Today</span>}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-gray-900)', marginTop: 2 }}>
                            {day.formattedDate}
                          </div>
                          {day.holiday && (
                            <div style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: day.holiday.type === 'Festival' ? '#b45309' : '#0369a1',
                              background: day.holiday.type === 'Festival' ? '#fef3c7' : '#e0f2fe',
                              border: day.holiday.type === 'Festival' ? '1px solid #fde68a' : '1px solid #bae6fd',
                              padding: '2px 6px',
                              borderRadius: 4,
                              marginTop: 4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              wordBreak: 'break-word',
                            }} title={`${day.holiday.name} (${day.holiday.type} Holiday)`}>
                              {day.holiday.type === 'Festival' ? '🎉' : '🌴'} {day.holiday.name}
                            </div>
                          )}
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
                            width: '100%',
                            padding: '6px',
                            marginBottom: 8,
                            border: '1px dashed var(--color-gray-300)',
                            background: 'transparent',
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
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        {dayItems.map((item, idx) => {
                          const isDone = item.status === 'Done';
                          const isNotDone = item.status === 'NotDone';
                          const isCancelled = item.status === 'Cancelled';

                          return (
                            <Draggable draggableId={`appt-${item.id}`} index={idx} key={item.id} isDragDisabled={!canEdit || item.status !== 'Scheduled'}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  onClick={() => setActionCard(item)}
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
                                    boxShadow: dragSnapshot.isDragging ? '0 8px 16px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                                    opacity: isCancelled ? 0.65 : 1,
                                    transition: 'transform 0.15s, box-shadow 0.15s',
                                    ...dragProvided.draggableProps.style,
                                  }}
                                >
                                  {/* Patient Name & Status Badge Tag */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 2 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-gray-900)', wordBreak: 'break-word', flex: 1 }}>
                                      {item.patientName}
                                    </div>
                                    <span style={{
                                      fontSize: 9,
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      whiteSpace: 'nowrap',
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

                                  {/* ID & Age / Sex */}
                                  <div style={{ fontSize: 11, color: 'var(--color-gray-600)', marginBottom: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600 }}>ID: {item.patientID}</span>
                                    {(item.patientAge != null || item.patientSex) && (
                                      <span>• {item.patientAge != null ? `${item.patientAge}Y` : ''}{item.patientSex ? `/${item.patientSex}` : ''}</span>
                                    )}
                                  </div>

                                  {/* Procedure & Modality */}
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)', marginBottom: item.appointmentTime || item.notDoneReason ? 2 : 0 }}>
                                    {item.procedureName} {item.modality ? `[${item.modality}]` : ''}
                                  </div>

                                  {/* Time (Optional) */}
                                  {item.appointmentTime && (
                                    <div style={{ fontSize: 10, color: 'var(--color-gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <FiClock size={10} /> {item.appointmentTime}
                                    </div>
                                  )}

                                  {/* Reason note if NotDone or Cancelled */}
                                  {item.notDoneReason && (
                                    <div style={{ fontSize: 10, color: isCancelled ? '#b91c1c' : '#92400e', fontStyle: 'italic', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.notDoneReason}>
                                      Reason: {item.notDoneReason}
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
      {showApptModal && (
        <div onClick={() => setShowApptModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-white)', color: 'var(--color-gray-900)', borderRadius: 10, padding: 20, width: 'min(540px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', border: '1px solid var(--color-gray-300)' }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 14, color: 'var(--color-gray-900)' }}>
              {apptModalMode === 'create' ? 'Schedule New Appointment' : 'Edit Appointment Details'}
            </div>
            <form onSubmit={handleSaveAppointment} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              
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
                    zIndex: 70,
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
        </div>
      )}

      {/* Mark Not Done Reason Modal */}
      {showNotDoneModal && notDoneItem && (
        <div onClick={() => setShowNotDoneModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-white)', color: 'var(--color-gray-900)', borderRadius: 10, padding: 20, width: 'min(440px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', border: '1px solid var(--color-gray-300)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: 'var(--color-gray-900)' }}>
              Mark Procedure as Not Done
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-gray-600)', marginBottom: 14 }}>
              Select or specify the reason why the procedure for <strong>{notDoneItem.patientName}</strong> was not performed:
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
          </div>
        </div>
      )}

      {/* Action Card Context Popover Modal */}
      {actionCard && (
        <div onClick={() => setActionCard(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-white)', color: 'var(--color-gray-900)', borderRadius: 12, padding: 20, width: 'min(440px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', border: '1px solid var(--color-gray-300)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-gray-900)' }}>{actionCard.patientName}</div>
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
          </div>
        </div>
      )}

      {/* Mark Cancelled Reason Modal */}
      {showCancelledModal && cancelledItem && (
        <div onClick={() => setShowCancelledModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 65 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-white)', color: 'var(--color-gray-900)', borderRadius: 10, padding: 20, width: 'min(440px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', border: '1px solid var(--color-gray-300)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: 'var(--color-gray-900)' }}>
              Mark Appointment as Cancelled
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-gray-600)', marginBottom: 14 }}>
              Select or specify the cancellation reason for <strong>{cancelledItem.patientName}</strong>:
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
          </div>
        </div>
      )}

      {/* Holiday Caution Confirmation Prompt Modal */}
      {pendingHolidayConfirm && (
        <div onClick={() => setPendingHolidayConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 75 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-white)', color: 'var(--color-gray-900)', borderRadius: 12, padding: 22, width: 'min(440px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', border: '1px solid #f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 700, color: '#b45309', marginBottom: 10 }}>
              <span>⚠️</span> Holiday Caution
            </div>
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
          </div>
        </div>
      )}

      {/* Manage Holiday List Modal */}
      {showHolidayModal && (
        <div onClick={() => setShowHolidayModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 65 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-white)', color: 'var(--color-gray-900)', borderRadius: 12, padding: 22, width: 'min(580px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', border: '1px solid var(--color-gray-300)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-gray-900)' }}>Manage Holiday List</div>
              <button onClick={() => setShowHolidayModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-gray-500)' }}>×</button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--color-gray-600)', marginBottom: 14 }}>
              Set your recurring weekly off day or add specific Festival and Personal holidays. Holiday dates are automatically highlighted with caution prompts during scheduling.
            </p>

            {/* Weekly Off Day Setting */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--color-gray-100)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
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
            <form onSubmit={handleAddHoliday} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr auto', gap: 10, alignItems: 'end', marginBottom: 18, background: 'var(--color-gray-100)', padding: 12, borderRadius: 8 }}>
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
                style={{ padding: '7px 14px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Add Holiday
              </button>
            </form>

            {/* Holidays List Table */}
            <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--color-gray-200)', borderRadius: 8 }}>
              {holidaysList.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-gray-500)', fontSize: 13 }}>No holidays added yet.</div>
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
          </div>
        </div>
      )}

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

