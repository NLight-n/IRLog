import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import NavBar from '../components/layout/NavBar';
import { FiMoreVertical } from 'react-icons/fi';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useAppSettings } from './_app';
import { useTheme } from '../lib/theme/ThemeContext';
import ProcedureLogModal from '../components/modals/ProcedureLogModal';

type WorkItem = {
  id: number;
  patientID: string;
  patientName: string;
  procedureName: string;
  modality?: string;
  stage: 'Pending' | 'OnEvaluation' | 'Scheduled' | 'Done';
  dateAdded?: string;
  dateEvaluated?: string;
  dateScheduled?: string;
  dateDone?: string;
};

const COLUMNS: Array<WorkItem['stage']> = ['Pending', 'OnEvaluation', 'Scheduled', 'Done'];
const SCHEDULE_DAYS = 7; // Yesterday, Today, next 5 days

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

export default function WorklistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { appHeading, appSubheading, appLogo } = useAppSettings();
  const { theme, setTheme } = useTheme();

  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [modalForm, setModalForm] = useState({ patientID: '', patientName: '', procedureName: '', modality: '', notes: '' });
  const formRef = useRef<HTMLFormElement | null>(null);
  const [showProcedureLogModal, setShowProcedureLogModal] = useState(false);
  const [procedureLogInitialData, setProcedureLogInitialData] = useState(null);

  // Search and filter states
  const [searchText, setSearchText] = useState('');
  const [dateFilter, setDateFilter] = useState('currentMonth');
  const [customDateRange, setCustomDateRange] = useState({ from: '', to: '' });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchText = e.target.value;
    setSearchText(newSearchText);
    if (newSearchText.trim() !== '') {
      setDateFilter('all');
    }
  };

  const clearSearch = () => {
    setSearchText('');
    setDateFilter('currentMonth');
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.replace('/login');
      return;
    }

    // Check permissions from session directly
    const perms = (session.user as any)?.permissions || {};
    setCanEdit(!!perms.editProcedureLog);

    fetch('/api/worklist')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Failed to load worklist');
        }
        const data = await res.json();
        let mapped: WorkItem[] = (Array.isArray(data) ? data : []).map((p: any) => ({
          id: p.id,
          patientName: p.patientName,
          patientID: p.patientID,
          procedureName: p.procedureName,
          modality: p.modality || undefined,
          stage: p.stage,
          dateAdded: p.dateAdded,
          dateEvaluated: p.dateEvaluated,
          dateScheduled: p.dateScheduled,
          dateDone: p.dateDone,
        }));

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayISO = yesterday.toISOString();

        const itemsToUpdate: { id: number; dateScheduled: string }[] = [];

        mapped = mapped.map(item => {
          if (item.stage === 'Scheduled' && item.dateScheduled) {
            const scheduledDate = new Date(item.dateScheduled);
            scheduledDate.setHours(0, 0, 0, 0);

            if (scheduledDate.getTime() < today.getTime() && scheduledDate.getTime() !== yesterday.getTime()) {
              itemsToUpdate.push({ id: item.id, dateScheduled: yesterdayISO });
              return { ...item, dateScheduled: yesterdayISO };
            }
          }
          return item;
        });

        setItems(mapped);
        setLoading(false);

        if (itemsToUpdate.length > 0) {
          itemsToUpdate.forEach(update => {
            fetch(`/api/worklist/${update.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dateScheduled: update.dateScheduled }),
            });
          });
        }
      })
      .catch((e) => {
        setError(e.message || 'Failed to load procedures');
        setLoading(false);
      });
  }, [session, status, router]);

  // Filtering logic
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search filter
      const search = searchText.trim().toLowerCase();
      if (search) {
        const searchFields = ['patientID', 'patientName', 'procedureName', 'notes'];
        const matches = searchFields.some(field => {
          let value = '';
          if (field === 'notes') value = (item as any).notes || '';
          else value = (item as any)[field] || '';
          return value.toString().toLowerCase().includes(search);
        });
        if (!matches) return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const dateFields = ['dateAdded', 'dateEvaluated', 'dateScheduled', 'dateDone'];
        let hasMatchingDate = false;

        for (const field of dateFields) {
          const itemDate = (item as any)[field];
          if (!itemDate) continue;

          const date = new Date(itemDate);
          date.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let match = false;

          if (dateFilter === 'today') {
            match = date.getTime() === today.getTime();
          } else if (dateFilter === 'yesterday') {
            const yest = new Date(today); yest.setDate(today.getDate() - 1);
            match = date.getTime() === yest.getTime();
          } else if (dateFilter === 'last7') {
            const d = new Date(today); d.setDate(today.getDate() - 6);
            match = date >= d && date <= today;
          } else if (dateFilter === 'currentMonth') {
            const from = new Date(today.getFullYear(), today.getMonth(), 1);
            const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            match = date >= from && date <= to;
          } else if (dateFilter === 'lastMonth') {
            const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const to = new Date(today.getFullYear(), today.getMonth(), 0);
            match = date >= from && date <= to;
          } else if (dateFilter === 'lastYear') {
            const d = new Date(today); d.setFullYear(today.getFullYear() - 1);
            match = date >= d && date <= today;
          } else if (dateFilter === 'custom') {
            if (customDateRange.from && customDateRange.to) {
              const from = new Date(customDateRange.from); from.setHours(0, 0, 0, 0);
              const to = new Date(customDateRange.to); to.setHours(0, 0, 0, 0);
              match = date >= from && date <= to;
            } else {
              match = true;
            }
          }

          if (match) {
            hasMatchingDate = true;
            break;
          }
        }

        if (!hasMatchingDate) return false;
      }

      return true;
    });
  }, [items, searchText, dateFilter, customDateRange]);

  const columns = useMemo(() => {
    const map: Record<string, WorkItem[]> = {};
    for (const col of COLUMNS) map[col] = [];
    for (const item of filteredItems) {
      const col = item.stage && COLUMNS.includes(item.stage) ? item.stage : 'Pending';
      map[col].push(item);
    }
    return map;
  }, [filteredItems]);

  const scheduleBuckets = useMemo(() => {
    const buckets: { key: string; label: string; dateISO: string }[] = [];
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = -1; i <= 5; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString();
      const dayName = dayNames[d.getDay()];
      const dateStr = d.toLocaleDateString();
      let label = '';

      if (i === -1) {
        label = 'Postponed';
      } else if (i === 0) {
        label = `Today (${dayName})`;
      } else {
        label = `${dayName}, ${dateStr}`;
      }

      buckets.push({ key, label, dateISO: d.toISOString() });
    }
    return buckets;
  }, []);

  const onDragEnd = async (result: DropResult) => {
    if (!canEdit) return;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const id = parseInt(draggableId.replace('wi-', ''));
    const destId = destination.droppableId;
    const isScheduleLane = destId.startsWith('Scheduled__');
    let newStage = (isScheduleLane ? 'Scheduled' : (destId as WorkItem['stage']));
    const payload: any = { stage: newStage };
    if (isScheduleLane) {
      const dateISO = destId.split('__')[1];
      payload.dateScheduled = dateISO;
    }

    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, stage: newStage, ...(payload.dateScheduled ? { dateScheduled: payload.dateScheduled } : {}) } : it)));

    try {
      const res = await fetch(`/api/worklist/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error('Failed to update');
      }
    } catch (e) {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it } : it)));
    }
    if (destination.droppableId === 'Done') {
      const item = items.find(it => it.id === id);
      if (item && window.confirm('Do you want to create a Procedure Log for this case?')) {
        const initialData = {
          patientID: item.patientID,
          patientName: item.patientName,
          procedureName: item.procedureName,
          modality: item.modality,
        };
        setProcedureLogInitialData(initialData as any);
        setShowProcedureLogModal(true);
      }
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
      // You can add error handling here, e.g., show a notification
      console.error('Failed to save procedure log');
    }
  };

  const openCreateModal = () => {
    if (!canEdit) {
      alert('You need edit permissions to create work items');
      return;
    }
    setEditingItem(null);
    setModalForm({ patientID: '', patientName: '', procedureName: '', modality: '', notes: '' });
    setModalMode('create');
    setShowModal(true);
  };

  const openEditModal = (item: WorkItem) => {
    if (!canEdit) return;
    setEditingItem(item);
    setModalForm({ patientID: item.patientID, patientName: item.patientName, procedureName: item.procedureName, modality: item.modality || '', notes: (item as any).notes || '' });
    setModalMode('edit');
    setShowModal(true);
  };

  const openViewModal = (item: WorkItem) => {
    setEditingItem(item);
    setModalForm({ patientID: item.patientID, patientName: item.patientName, procedureName: item.procedureName, modality: item.modality || '', notes: (item as any).notes || '' });
    setModalMode('view');
    setShowModal(true);
  };

  const submitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!modalForm.patientID || !modalForm.patientName || !modalForm.procedureName) return;
    const payload = { ...modalForm } as any;
    if (!payload.modality) delete payload.modality;
    if (!payload.notes) delete payload.notes;
    if (modalMode === 'create' && !editingItem) {
      const res = await fetch('/api/worklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const created = await res.json();
        setItems((prev) => [{ ...created }, ...prev]);
        setShowModal(false);
      }
    } else if (modalMode === 'edit' && editingItem) {
      const res = await fetch(`/api/worklist/${editingItem.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const updated = await res.json();
        setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
        setShowModal(false);
      }
    }
  };

  // Quick keyboard shortcuts within modal
  useEffect(() => {
    if (!showModal) return;
    function onKeyDown(ev: KeyboardEvent) {
      if (!showModal) return;
      const isCmdOrCtrl = ev.ctrlKey || ev.metaKey;

      // ESC closes modal
      if (ev.key === 'Escape') {
        ev.preventDefault();
        setShowModal(false);
        return;
      }

      // Ctrl/Cmd+S submits in create/edit
      if ((ev.key === 's' || ev.key === 'S') && isCmdOrCtrl) {
        ev.preventDefault();
        if (modalMode === 'edit' || modalMode === 'create') {
          if (formRef.current) {
            (formRef.current as HTMLFormElement).requestSubmit();
          }
        }
        return;
      }

      // Ctrl+E toggles to edit from view (if permitted)
      if ((ev.key === 'e' || ev.key === 'E') && isCmdOrCtrl && modalMode === 'view' && canEdit) {
        ev.preventDefault();
        setModalMode('edit');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showModal, modalMode, canEdit]);

  // Keyboard shortcut for clearing search
  useEffect(() => {
    if (showModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal]);

  if (status === 'loading' || loading) return (
    <div>
      <NavBar user={session?.user} onToggleTheme={setTheme} theme={theme} appHeading={appHeading} appSubheading={appSubheading} appLogo={appLogo} />
      <div style={{ paddingTop: 96, paddingInline: 16 }}>Loading...</div>
    </div>
  );

  if (error) return (
    <div>
      <NavBar user={session?.user} onToggleTheme={setTheme} theme={theme} appHeading={appHeading} appSubheading={appSubheading} appLogo={appLogo} />
      <div style={{ paddingTop: 96, paddingInline: 16, color: 'var(--color-error)' }}>{error}</div>
    </div>
  );

  return (
    <div>
      <NavBar user={session?.user} onToggleTheme={setTheme} theme={theme} appHeading={appHeading} appSubheading={appSubheading} appLogo={appLogo} />
      <div style={{ paddingTop: 64, paddingInline: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Worklist</h2>
            <span style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-contrast, #fff)',
              borderRadius: '50%',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
            }}>
              {filteredItems.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--color-gray-700)' }}>
                Search
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by Patient ID, Name, Procedure, or Notes..."
                  value={searchText}
                  onChange={handleSearchChange}
                  style={{
                    width: '250px',
                    padding: '8px 32px 8px 12px',
                  }}
                />
                {searchText && (
                  <button
                    onClick={clearSearch}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 20,
                      lineHeight: 1,
                      color: 'red',
                      padding: 0,
                    }}
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--color-gray-700)' }}>
                Date Filter
              </label>
              <select
                value={dateFilter}
                className="form-input"
                onChange={(e) => setDateFilter(e.target.value)}
                style={{
                  width: '180px',
                }}
              >
                {DATE_FILTERS.map(filter => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'end', marginBottom: 16, justifyContent: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--color-gray-700)' }}>
                From Date
              </label>
              <input
                type="date"
                value={customDateRange.from}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, from: e.target.value }))}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--color-gray-300)',
                  borderRadius: 6,
                  background: 'var(--color-white)',
                  color: 'var(--color-gray-900)'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--color-gray-700)' }}>
                To Date
              </label>
              <input
                type="date"
                value={customDateRange.to}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, to: e.target.value }))}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--color-gray-300)',
                  borderRadius: 6,
                  background: 'var(--color-white)',
                  color: 'var(--color-gray-900)'
                }}
              />
            </div>
          </div>
        )}



        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLUMNS.length}, 1fr)`, gap: 16 }}>
            {COLUMNS.map((col) => (
              <Droppable droppableId={col} key={col} isDropDisabled={!canEdit}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      background: snapshot.isDraggingOver ? 'var(--color-gray-50)' : 'var(--color-gray-50)',
                      border: '1px solid var(--color-gray-200)',
                      borderRadius: 8,
                      padding: 12,
                      minHeight: 400,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{col}</span>
                      <span style={{
                        background: 'var(--color-accent)',
                        color: 'var(--color-accent-contrast, #fff)',
                        borderRadius: '50%',
                        width: 22,
                        height: 22,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                      }}>
                        {columns[col].length}
                      </span>
                    </div>

                    {/* Add New Case button in Pending column */}
                    {col === 'Pending' && canEdit && (
                      <button
                        onClick={openCreateModal}
                        style={{
                          width: '100%',
                          padding: '12px',
                          marginBottom: 12,
                          border: '2px dashed var(--color-accent)',
                          background: 'transparent',
                          color: 'var(--color-accent)',
                          borderRadius: 8,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--color-accent)';
                          e.currentTarget.style.color = 'var(--color-accent-contrast, #fff)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--color-accent)';
                        }}
                      >
                        + Add New Case
                      </button>
                    )}

                    {col !== 'Scheduled' && (
                      <>
                        {columns[col].map((item, idx) => (
                          <Draggable draggableId={`wi-${item.id}`} index={idx} key={item.id} isDragDisabled={!canEdit}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={() => openViewModal(item)}
                                onMouseEnter={(e) => {
                                  if (dragSnapshot.isDragging) return;
                                  e.currentTarget.style.background = 'var(--color-accent)';
                                  e.currentTarget.style.color = 'var(--color-accent-contrast, #fff)';
                                }}
                                onMouseLeave={(e) => {
                                  if (dragSnapshot.isDragging) return;
                                  e.currentTarget.style.background = 'var(--color-white)';
                                  e.currentTarget.style.color = 'var(--color-gray-900)';
                                }}
                                style={{
                                  userSelect: 'none',
                                  padding: 12,
                                  marginBottom: 8,
                                  background: dragSnapshot.isDragging ? 'var(--color-accent)' : 'var(--color-white)',
                                  color: dragSnapshot.isDragging ? 'var(--color-accent-contrast, #fff)' : 'var(--color-gray-900)',
                                  border: '1px solid var(--color-accent)',
                                  borderRadius: 8,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  ...dragProvided.draggableProps.style,
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 600 }}>{item.patientName} ({item.patientID})</div>
                                  <div style={{ fontSize: 12, opacity: 0.8 }}>{item.procedureName}{item.modality ? ` • ${item.modality}` : ''}</div>

                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </>
                    )}
                    {col === 'Scheduled' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {scheduleBuckets.map((bucket) => (
                          <div key={bucket.key}>
                            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8, margin: '6px 0' }}>{bucket.label}</div>
                            <Droppable droppableId={`Scheduled__${bucket.dateISO}`}>
                              {(subProvided, subSnapshot) => (
                                <div ref={subProvided.innerRef} {...subProvided.droppableProps} style={{
                                  background: subSnapshot.isDraggingOver ? 'rgba(59,130,246,0.1)' : 'var(--color-white)',
                                  border: '1px dashed var(--color-gray-200)',
                                  borderRadius: 6,
                                  padding: 8,
                                  minHeight: 60,
                                }}>
                                  {columns['Scheduled']
                                    .filter((it) => {
                                      if (!it.dateScheduled) return false;
                                      const d = new Date(it.dateScheduled); d.setHours(0, 0, 0, 0);
                                      return d.toISOString() === bucket.dateISO;
                                    })
                                    .map((item, idx) => (
                                      <Draggable draggableId={`wi-${item.id}`} index={idx} key={item.id} isDragDisabled={!canEdit}>
                                        {(dragProvided, dragSnapshot) => (
                                          <div
                                            ref={dragProvided.innerRef}
                                            {...dragProvided.draggableProps}
                                            {...dragProvided.dragHandleProps}
                                            onClick={() => openViewModal(item)}
                                            onMouseEnter={(e) => {
                                              if (dragSnapshot.isDragging) return;
                                              e.currentTarget.style.background = 'var(--color-accent)';
                                              e.currentTarget.style.color = 'var(--color-accent-contrast, #fff)';
                                            }}
                                            onMouseLeave={(e) => {
                                              if (dragSnapshot.isDragging) return;
                                              e.currentTarget.style.background = 'var(--color-white)';
                                              e.currentTarget.style.color = 'var(--color-gray-900)';
                                            }}
                                            style={{
                                              userSelect: 'none',
                                              padding: 12,
                                              marginBottom: 8,
                                              background: dragSnapshot.isDragging ? 'var(--color-accent)' : 'var(--color-white)',
                                              color: dragSnapshot.isDragging ? 'var(--color-accent-contrast, #fff)' : 'var(--color-gray-900)',
                                              border: '1px solid var(--color-accent)',
                                              borderRadius: 8,
                                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                              cursor: 'pointer',
                                              transition: 'all 0.2s',
                                              ...dragProvided.draggableProps.style,
                                            }}
                                          >
                                            <div>
                                              <div style={{ fontWeight: 600 }}>{item.patientName} ({item.patientID})</div>
                                              <div style={{ fontSize: 12, opacity: 0.8 }}>{item.procedureName}{item.modality ? ` • ${item.modality}` : ''}</div>

                                            </div>
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                  {subProvided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>

      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-white)', borderRadius: 8, padding: 16, width: 'min(640px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>
              {modalMode === 'create' ? 'Create Work Item' : modalMode === 'edit' ? 'Edit Work Item' : 'Work Item Details'}
            </div>
            {editingItem && (
              <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--color-gray-600)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {editingItem.dateAdded && <div>Added: {new Date(editingItem.dateAdded).toLocaleString()}</div>}
                {editingItem.dateEvaluated && <div>Evaluated: {new Date(editingItem.dateEvaluated).toLocaleString()}</div>}
                {editingItem.dateScheduled && <div>Scheduled: {new Date(editingItem.dateScheduled).toLocaleString()}</div>}
                {editingItem.dateDone && <div>Done: {new Date(editingItem.dateDone).toLocaleString()}</div>}
              </div>
            )}
            <form ref={formRef} onSubmit={submitModal} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Patient ID</span>
                <input required disabled={modalMode === 'view'} value={modalForm.patientID} onChange={(e) => setModalForm({ ...modalForm, patientID: e.target.value })} style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Patient Name</span>
                <input required disabled={modalMode === 'view'} value={modalForm.patientName} onChange={(e) => setModalForm({ ...modalForm, patientName: e.target.value })} style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Procedure Name</span>
                <input required disabled={modalMode === 'view'} value={modalForm.procedureName} onChange={(e) => setModalForm({ ...modalForm, procedureName: e.target.value })} style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Modality (optional)</span>
                <input disabled={modalMode === 'view'} value={modalForm.modality} onChange={(e) => setModalForm({ ...modalForm, modality: e.target.value })} style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Notes (optional)</span>
                <textarea disabled={modalMode === 'view'} value={modalForm.notes} onChange={(e) => setModalForm({ ...modalForm, notes: e.target.value })} rows={3} style={{ padding: 8, border: '1px solid var(--color-gray-300)', borderRadius: 6, resize: 'vertical', background: 'var(--color-white)', color: 'var(--color-gray-900)' }} />
              </label>

              <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <div>
                  {modalMode !== 'create' && canEdit && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!editingItem) return;
                        if (!confirm('Delete this work item?')) return;
                        const res = await fetch(`/api/worklist/${editingItem.id}`, { method: 'DELETE' });
                        if (res.status === 204) {
                          setItems((prev) => prev.filter((it) => it.id !== editingItem.id));
                          setShowModal(false);
                        }
                      }}
                      style={{ padding: '8px 12px', border: '1px solid var(--color-error)', color: 'var(--color-error)', borderRadius: 6, background: 'var(--color-white)' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 12px', border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}>Close</button>
                  {modalMode === 'view' && canEdit && (
                    <button type="button" onClick={() => setModalMode('edit')} style={{ padding: '8px 12px', border: '1px solid var(--color-gray-300)', borderRadius: 6, background: 'var(--color-white)', color: 'var(--color-gray-900)' }}>Edit</button>
                  )}
                  {(modalMode === 'create' || modalMode === 'edit') && (
                    <button type="submit" style={{ padding: '8px 12px', border: '1px solid var(--color-accent)', background: 'var(--color-accent)', color: 'var(--color-accent-contrast, #fff)', borderRadius: 6, fontWeight: 600 }}>{modalMode === 'edit' ? 'Save Changes' : 'Create'}</button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
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

