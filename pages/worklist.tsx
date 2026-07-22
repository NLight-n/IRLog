import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import NavBar from '../components/layout/NavBar';
import { FiClock, FiPlus, FiEdit2, FiCheckCircle, FiXCircle, FiChevronLeft, FiChevronRight, FiSearch } from 'react-icons/fi';
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

const PRESET_NOT_DONE_REASONS = [
  "Patient didn't show up",
  "Coagulation parameters deranged",
  "Hemodynamically unstable",
  "Patient refused procedure",
  "Equipment / Technical issue",
  "NPO status not maintained",
  "Other (specified below)"
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

  // Date range state: startDate represents Day 0 of the 7-day view
  const [startDate, setStartDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  // Search filter
  const [searchText, setSearchText] = useState('');

  // Modals state
  const [showApptModal, setShowApptModal] = useState(false);
  const [apptModalMode, setApptModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<AppointmentItem | null>(null);
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

  // Not Done Reason Modal state
  const [showNotDoneModal, setShowNotDoneModal] = useState(false);
  const [notDoneItem, setNotDoneItem] = useState<AppointmentItem | null>(null);
  const [selectedReason, setSelectedReason] = useState(PRESET_NOT_DONE_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  // IRLog Procedure Log Modal state
  const [showProcedureLogModal, setShowProcedureLogModal] = useState(false);
  const [procedureLogInitialData, setProcedureLogInitialData] = useState<any>(null);

  // Load items
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

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.replace('/login');
      return;
    }
    const perms = (session.user as any)?.permissions || {};
    setCanEdit(!!perms.editProcedureLog);

    loadAppointments();
  }, [session, status, router]);

  // Generate 7 days columns starting from startDate
  const daysList = useMemo(() => {
    const days: { dateKey: string; dateObj: Date; dayName: string; formattedDate: string; isToday: boolean }[] = [];
    const todayStr = formatDateKey(new Date());

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      d.setHours(0, 0, 0, 0);

      const dateKey = formatDateKey(d);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const formattedDate = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

      days.push({
        dateKey,
        dateObj: d,
        dayName,
        formattedDate,
        isToday: dateKey === todayStr,
      });
    }
    return days;
  }, [startDate]);

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

  // Drag and Drop Handler
  const onDragEnd = async (result: DropResult) => {
    if (!canEdit) return;
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const itemId = parseInt(draggableId.replace('appt-', ''), 10);
    const sourceDateKey = source.droppableId;
    const destDateKey = destination.droppableId;

    // Create shallow clone of items
    const newItems = [...items];
    const itemIndex = newItems.findIndex(it => it.id === itemId);
    if (itemIndex === -1) return;

    const targetItem = { ...newItems[itemIndex] };

    // If date changed
    if (sourceDateKey !== destDateKey) {
      targetItem.dateScheduled = new Date(`${destDateKey}T00:00:00`).toISOString();
    }

    // Extract items in destination column
    const destColumnItems = newItems
      .filter(it => {
        if (it.id === itemId) return false;
        const k = it.dateScheduled ? formatDateKey(new Date(it.dateScheduled)) : '';
        return k === destDateKey;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);

    // Insert targetItem at destination.index
    destColumnItems.splice(destination.index, 0, targetItem);

    // Update displayOrder for all items in destination column
    destColumnItems.forEach((it, idx) => {
      it.displayOrder = idx;
    });

    // Update state optimistically
    const updatedMap = new Map(destColumnItems.map(it => [it.id, it]));
    const finalItems = newItems.map(it => updatedMap.get(it.id) || (it.id === itemId ? targetItem : it));
    setItems(finalItems);

    // API calls to persist date update and order
    try {
      // Update target item date & display order
      await fetch(`/api/worklist/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateScheduled: targetItem.dateScheduled,
          displayOrder: destination.index,
        }),
      });

      // Update remaining column display orders in background
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
    setApptModalMode('edit');
    setShowApptModal(true);
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
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
        method: 'PATCH',
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
    <div style={{ minHeight: '100vh', background: 'var(--color-bg, #f8fafc)', display: 'flex', flexDirection: 'column' }}>
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
                          ? 'var(--color-accent-light, #eff6ff)'
                          : day.isToday
                          ? 'var(--color-accent-subtle, #f0f7ff)'
                          : 'var(--color-gray-50, #f8fafc)',
                        border: day.isToday ? '2px solid var(--color-accent)' : '1px solid var(--color-gray-200)',
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
                        alignItems: 'center',
                        marginBottom: 10,
                        paddingBottom: 8,
                        borderBottom: '1px solid var(--color-gray-200)'
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: day.isToday ? 'var(--color-accent)' : 'var(--color-gray-800)' }}>
                            {day.dayName} {day.isToday && <span style={{ fontSize: 11, background: 'var(--color-accent)', color: '#fff', borderRadius: 4, padding: '1px 4px', marginLeft: 4 }}>Today</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-gray-500)' }}>{day.formattedDate}</div>
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
                            <Draggable draggableId={`appt-${item.id}`} index={idx} key={item.id} isDragDisabled={!canEdit}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  style={{
                                    userSelect: 'none',
                                    padding: 10,
                                    marginBottom: 8,
                                    background: dragSnapshot.isDragging ? 'var(--color-white)' : 'var(--color-white)',
                                    border: isDone
                                      ? '1px solid #22c55e'
                                      : isNotDone
                                      ? '1px solid #ef4444'
                                      : isCancelled
                                      ? '1px solid var(--color-gray-300)'
                                      : '1px solid var(--color-accent)',
                                    borderRadius: 8,
                                    boxShadow: dragSnapshot.isDragging ? '0 8px 16px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                                    opacity: isCancelled ? 0.6 : 1,
                                    ...dragProvided.draggableProps.style,
                                  }}
                                >
                                  {/* Patient Header & ID */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-gray-900)', wordBreak: 'break-word' }}>
                                      {item.patientName}
                                    </div>
                                    {canEdit && (
                                      <button
                                        onClick={() => openEditModal(item)}
                                        title="Edit appointment"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--color-gray-500)' }}
                                      >
                                        <FiEdit2 size={12} />
                                      </button>
                                    )}
                                  </div>

                                  {/* Age / Sex / Patient ID */}
                                  <div style={{ fontSize: 11, color: 'var(--color-gray-600)', marginBottom: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, background: 'var(--color-gray-100)', padding: '1px 4px', borderRadius: 4 }}>ID: {item.patientID}</span>
                                    {(item.patientAge != null || item.patientSex) && (
                                      <span>
                                        {item.patientAge != null ? `${item.patientAge} yrs` : ''} {item.patientSex ? `/ ${item.patientSex}` : ''}
                                      </span>
                                    )}
                                  </div>

                                  {/* Procedure Name & Modality */}
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)', marginBottom: 4 }}>
                                    {item.procedureName} {item.modality ? `(${item.modality})` : ''}
                                  </div>

                                  {/* Time (Optional) */}
                                  {item.appointmentTime && (
                                    <div style={{ fontSize: 11, color: 'var(--color-gray-700)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                      <FiClock size={11} /> {item.appointmentTime}
                                    </div>
                                  )}

                                  {/* Status Badges */}
                                  {isDone && (
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                      <FiCheckCircle size={12} /> Done
                                    </div>
                                  )}
                                  {isNotDone && (
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '3px 6px', borderRadius: 4, marginTop: 4 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <FiXCircle size={12} /> Not Done
                                      </div>
                                      {item.notDoneReason && <div style={{ fontWeight: 400, marginTop: 2, fontStyle: 'italic' }}>Reason: {item.notDoneReason}</div>}
                                    </div>
                                  )}
                                  {isCancelled && (
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-gray-500)', marginTop: 4 }}>
                                      Cancelled
                                    </div>
                                  )}

                                  {/* Quick Action Buttons for Today/Scheduled Procedures */}
                                  {!isDone && !isNotDone && !isCancelled && canEdit && (
                                    <div style={{ display: 'flex', gap: 4, marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--color-gray-200)' }}>
                                      <button
                                        onClick={() => handleMarkDone(item)}
                                        title="Mark Done"
                                        style={{
                                          flex: 1,
                                          padding: '4px',
                                          background: '#dcfce7',
                                          color: '#15803d',
                                          border: 'none',
                                          borderRadius: 4,
                                          fontSize: 11,
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: 2,
                                        }}
                                      >
                                        <FiCheckCircle size={11} /> Done
                                      </button>
                                      <button
                                        onClick={() => handleOpenNotDoneModal(item)}
                                        title="Mark Not Done"
                                        style={{
                                          flex: 1,
                                          padding: '4px',
                                          background: '#fee2e2',
                                          color: '#b91c1c',
                                          border: 'none',
                                          borderRadius: 4,
                                          fontSize: 11,
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: 2,
                                        }}
                                      >
                                        <FiXCircle size={11} /> Not Done
                                      </button>
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
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-white)', borderRadius: 10, padding: 20, width: 'min(540px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 14, color: 'var(--color-gray-900)' }}>
              {apptModalMode === 'create' ? 'Schedule New Appointment' : 'Edit Appointment Details'}
            </div>
            <form onSubmit={handleSaveAppointment} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Patient ID *</span>
                <input
                  required
                  value={formState.patientID}
                  onChange={(e) => setFormState({ ...formState, patientID: e.target.value })}
                  style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Patient Name *</span>
                <input
                  required
                  value={formState.patientName}
                  onChange={(e) => setFormState({ ...formState, patientName: e.target.value })}
                  style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Age</span>
                <input
                  type="number"
                  placeholder="e.g. 45"
                  value={formState.patientAge}
                  onChange={(e) => setFormState({ ...formState, patientAge: e.target.value })}
                  style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
                />
              </label>

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

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Procedure Name *</span>
                <input
                  required
                  placeholder="e.g. DSA / Angiography / Biopsy"
                  value={formState.procedureName}
                  onChange={(e) => setFormState({ ...formState, procedureName: e.target.value })}
                  style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Modality</span>
                <input
                  placeholder="e.g. DSA, USG, CT"
                  value={formState.modality}
                  onChange={(e) => setFormState({ ...formState, modality: e.target.value })}
                  style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Appointment Time (Optional)</span>
                <input
                  type="time"
                  value={formState.appointmentTime}
                  onChange={(e) => setFormState({ ...formState, appointmentTime: e.target.value })}
                  style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
                />
              </label>

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

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)' }}>Notes (Optional)</span>
                <textarea
                  rows={2}
                  value={formState.notes}
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)', resize: 'vertical' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gridColumn: '1 / -1', marginTop: 8 }}>
                <div>
                  {apptModalMode === 'edit' && editingItem && canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAppointment(editingItem.id)}
                      style={{ padding: '8px 14px', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowApptModal(false)}
                    style={{ padding: '8px 14px', border: '1px solid var(--color-gray-300)', borderRadius: 6, background: '#fff', color: 'var(--color-gray-900)', cursor: 'pointer' }}
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
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-white)', borderRadius: 10, padding: 20, width: 'min(440px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
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
                style={{ width: '100%', padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, marginBottom: 14, fontSize: 13 }}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowNotDoneModal(false)}
                style={{ padding: '8px 14px', border: '1px solid var(--color-gray-300)', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
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

