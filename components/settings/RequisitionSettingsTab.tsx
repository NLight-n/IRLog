import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiCheck,
  FiX,
  FiCheckSquare,
  FiLayers,
  FiFileText,
  FiMapPin,
  FiUserCheck,
} from 'react-icons/fi';
import { MdDragIndicator } from 'react-icons/md';
import {
  DEFAULT_REQUISITION_PROCEDURES,
  DEFAULT_REQUISITION_SAMPLES,
  DEFAULT_REQUISITION_WARDS,
  DEFAULT_REQUISITION_DESIGNATIONS,
  DEFAULT_REQUISITION_ORDERS,
} from '../../pages/api/settings/index';

type SectionKey = 'procedures' | 'samples' | 'wards' | 'designations' | 'orders';

export default function RequisitionSettingsTab() {
  const { data: session } = useSession();
  const perms = (session?.user as any)?.permissions || {};
  const canEdit = !!(perms.editSettings || perms.manageUsers);

  const [procedures, setProcedures] = useState<string[]>(DEFAULT_REQUISITION_PROCEDURES);
  const [samples, setSamples] = useState<string[]>(DEFAULT_REQUISITION_SAMPLES);
  const [wards, setWards] = useState<string[]>(DEFAULT_REQUISITION_WARDS);
  const [designations, setDesignations] = useState<string[]>(DEFAULT_REQUISITION_DESIGNATIONS);
  const [orders, setOrders] = useState<Record<string, string[]>>(DEFAULT_REQUISITION_ORDERS);
  const [selectedOrderProc, setSelectedOrderProc] = useState<string>('Biopsy');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Drag and Drop reordering states
  const [dragSource, setDragSource] = useState<{ section: SectionKey; index: number } | null>(null);
  const [dragTarget, setDragTarget] = useState<{ section: SectionKey; index: number } | null>(null);

  // New item inputs
  const [newProcedure, setNewProcedure] = useState('');
  const [newSample, setNewSample] = useState('');
  const [newWard, setNewWard] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [newOrderItem, setNewOrderItem] = useState('');

  // Editing states
  const [editingProcedureIdx, setEditingProcedureIdx] = useState<number | null>(null);
  const [editingProcedureVal, setEditingProcedureVal] = useState('');
  const [editingSampleIdx, setEditingSampleIdx] = useState<number | null>(null);
  const [editingSampleVal, setEditingSampleVal] = useState('');
  const [editingWardIdx, setEditingWardIdx] = useState<number | null>(null);
  const [editingWardVal, setEditingWardVal] = useState('');
  const [editingDesignationIdx, setEditingDesignationIdx] = useState<number | null>(null);
  const [editingDesignationVal, setEditingDesignationVal] = useState('');
  const [editingOrderIdx, setEditingOrderIdx] = useState<number | null>(null);
  const [editingOrderVal, setEditingOrderVal] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.requisitionProcedures) && data.requisitionProcedures.length > 0) {
          setProcedures(data.requisitionProcedures);
          if (!data.requisitionProcedures.includes(selectedOrderProc)) {
            setSelectedOrderProc(data.requisitionProcedures[0]);
          }
        }
        if (Array.isArray(data.requisitionSamples) && data.requisitionSamples.length > 0) {
          setSamples(data.requisitionSamples);
        }
        if (Array.isArray(data.requisitionWards) && data.requisitionWards.length > 0) {
          setWards(data.requisitionWards);
        }
        if (Array.isArray(data.requisitionDesignations) && data.requisitionDesignations.length > 0) {
          setDesignations(data.requisitionDesignations);
        }
        if (data.requisitionOrders && typeof data.requisitionOrders === 'object') {
          setOrders(data.requisitionOrders);
        }
      })
      .catch(err => {
        console.error('Failed to load settings:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  const handleSaveAll = async (
    procList = procedures,
    sampleList = samples,
    ordersMap = orders,
    wardList = wards,
    designationList = designations
  ) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requisitionProcedures: procList,
          requisitionSamples: sampleList,
          requisitionOrders: ordersMap,
          requisitionWards: wardList,
          requisitionDesignations: designationList,
        }),
      });
      if (!res.ok) throw new Error('Failed to update settings');
    } catch (err: any) {
      showMsg(err.message || 'Error saving settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Reorder helper
  const reorderList = (list: string[], fromIndex: number, toIndex: number): string[] => {
    const result = [...list];
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    return result;
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, section: SectionKey, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${section}:${index}`);
    setDragSource({ section, index });
  };

  const handleDragOver = (e: React.DragEvent, section: SectionKey, index: number) => {
    e.preventDefault();
    if (dragSource && dragSource.section === section && dragSource.index !== index) {
      e.dataTransfer.dropEffect = 'move';
      if (!dragTarget || dragTarget.section !== section || dragTarget.index !== index) {
        setDragTarget({ section, index });
      }
    }
  };

  const handleDrop = (e: React.DragEvent, section: SectionKey, targetIndex: number) => {
    e.preventDefault();
    if (!dragSource || dragSource.section !== section || dragSource.index === targetIndex) {
      setDragSource(null);
      setDragTarget(null);
      return;
    }
    const fromIndex = dragSource.index;
    setDragSource(null);
    setDragTarget(null);

    if (section === 'procedures') {
      const updated = reorderList(procedures, fromIndex, targetIndex);
      setProcedures(updated);
      handleSaveAll(updated, samples, orders, wards, designations);
      showMsg('Procedures reordered and saved');
    } else if (section === 'samples') {
      const updated = reorderList(samples, fromIndex, targetIndex);
      setSamples(updated);
      handleSaveAll(procedures, updated, orders, wards, designations);
      showMsg('Samples reordered and saved');
    } else if (section === 'wards') {
      const updated = reorderList(wards, fromIndex, targetIndex);
      setWards(updated);
      handleSaveAll(procedures, samples, orders, updated, designations);
      showMsg('Wards reordered and saved');
    } else if (section === 'designations') {
      const updated = reorderList(designations, fromIndex, targetIndex);
      setDesignations(updated);
      handleSaveAll(procedures, samples, orders, wards, updated);
      showMsg('Designations reordered and saved');
    } else if (section === 'orders') {
      const currentOrders =
        orders[selectedOrderProc] ||
        DEFAULT_REQUISITION_ORDERS[selectedOrderProc] ||
        DEFAULT_REQUISITION_ORDERS['Others'] ||
        [];
      const updated = reorderList(currentOrders, fromIndex, targetIndex);
      const updatedOrders = { ...orders, [selectedOrderProc]: updated };
      setOrders(updatedOrders);
      handleSaveAll(procedures, samples, updatedOrders, wards, designations);
      showMsg(`Orders for ${selectedOrderProc} reordered and saved`);
    }
  };

  const handleDragEnd = () => {
    setDragSource(null);
    setDragTarget(null);
  };

  // Sort handlers
  const handleSort = (section: SectionKey, direction: 'asc' | 'desc') => {
    if (!canEdit) return;

    const sortAlphabetical = (list: string[]) => {
      return [...list].sort((a, b) => {
        const cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        return direction === 'asc' ? cmp : -cmp;
      });
    };

    if (section === 'procedures') {
      const sorted = sortAlphabetical(procedures);
      setProcedures(sorted);
      handleSaveAll(sorted, samples, orders, wards, designations);
      showMsg(`Procedures sorted ${direction === 'asc' ? 'A → Z' : 'Z → A'} and saved`);
    } else if (section === 'samples') {
      const sorted = sortAlphabetical(samples);
      setSamples(sorted);
      handleSaveAll(procedures, sorted, orders, wards, designations);
      showMsg(`Samples sorted ${direction === 'asc' ? 'A → Z' : 'Z → A'} and saved`);
    } else if (section === 'wards') {
      const sorted = sortAlphabetical(wards);
      setWards(sorted);
      handleSaveAll(procedures, samples, orders, sorted, designations);
      showMsg(`Wards sorted ${direction === 'asc' ? 'A → Z' : 'Z → A'} and saved`);
    } else if (section === 'designations') {
      const sorted = sortAlphabetical(designations);
      setDesignations(sorted);
      handleSaveAll(procedures, samples, orders, wards, sorted);
      showMsg(`Designations sorted ${direction === 'asc' ? 'A → Z' : 'Z → A'} and saved`);
    } else if (section === 'orders') {
      const currentOrders =
        orders[selectedOrderProc] ||
        DEFAULT_REQUISITION_ORDERS[selectedOrderProc] ||
        DEFAULT_REQUISITION_ORDERS['Others'] ||
        [];
      const sorted = sortAlphabetical(currentOrders);
      const updatedOrders = { ...orders, [selectedOrderProc]: sorted };
      setOrders(updatedOrders);
      handleSaveAll(procedures, samples, updatedOrders, wards, designations);
      showMsg(`Orders for ${selectedOrderProc} sorted ${direction === 'asc' ? 'A → Z' : 'Z → A'} and saved`);
    }
  };

  // Procedures handlers
  const handleAddProcedure = () => {
    const trimmed = newProcedure.trim();
    if (!trimmed) return;
    if (procedures.includes(trimmed)) {
      showMsg('Procedure item already exists', 'error');
      return;
    }
    const updated = [...procedures, trimmed];
    setProcedures(updated);
    setNewProcedure('');
    const updatedOrders = { ...orders };
    if (!updatedOrders[trimmed]) {
      updatedOrders[trimmed] = [
        'Verify pre-procedure baseline vitals and recent lab investigations (CBC, Coagulation).',
        'Confirm NPO status with IR team.',
        'Ensure active IV access and informed written consent.',
      ];
      setOrders(updatedOrders);
    }
    handleSaveAll(updated, samples, updatedOrders, wards, designations);
    showMsg('New procedure added and saved');
  };

  const handleDeleteProcedure = (idx: number) => {
    if (!canEdit) return;
    const removedProc = procedures[idx];
    const updated = procedures.filter((_, i) => i !== idx);
    setProcedures(updated);
    if (selectedOrderProc === removedProc && updated.length > 0) {
      setSelectedOrderProc(updated[0]);
    }
    handleSaveAll(updated, samples, orders, wards, designations);
    showMsg('Procedure removed');
  };

  const handleSaveEditProcedure = (idx: number) => {
    const trimmed = editingProcedureVal.trim();
    if (!trimmed) return;
    const oldName = procedures[idx];
    const updated = [...procedures];
    updated[idx] = trimmed;
    setProcedures(updated);
    setEditingProcedureIdx(null);

    const updatedOrders = { ...orders };
    if (oldName !== trimmed && updatedOrders[oldName]) {
      updatedOrders[trimmed] = updatedOrders[oldName];
      delete updatedOrders[oldName];
      setOrders(updatedOrders);
    }
    if (selectedOrderProc === oldName) {
      setSelectedOrderProc(trimmed);
    }
    handleSaveAll(updated, samples, updatedOrders, wards, designations);
    showMsg('Procedure updated');
  };

  // Samples handlers
  const handleAddSample = () => {
    const trimmed = newSample.trim();
    if (!trimmed) return;
    if (samples.includes(trimmed)) {
      showMsg('Sample type already exists', 'error');
      return;
    }
    const updated = [...samples, trimmed];
    setSamples(updated);
    setNewSample('');
    handleSaveAll(procedures, updated, orders, wards, designations);
    showMsg('New sample test added and saved');
  };

  const handleDeleteSample = (idx: number) => {
    if (!canEdit) return;
    const updated = samples.filter((_, i) => i !== idx);
    setSamples(updated);
    handleSaveAll(procedures, updated, orders, wards, designations);
    showMsg('Sample test removed');
  };

  const handleSaveEditSample = (idx: number) => {
    const trimmed = editingSampleVal.trim();
    if (!trimmed) return;
    const updated = [...samples];
    updated[idx] = trimmed;
    setSamples(updated);
    setEditingSampleIdx(null);
    handleSaveAll(procedures, updated, orders, wards, designations);
    showMsg('Sample test updated');
  };

  // Wards handlers
  const handleAddWard = () => {
    const trimmed = newWard.trim();
    if (!trimmed) return;
    if (wards.includes(trimmed)) {
      showMsg('Ward already exists', 'error');
      return;
    }
    const updated = [...wards, trimmed];
    setWards(updated);
    setNewWard('');
    handleSaveAll(procedures, samples, orders, updated, designations);
    showMsg('New ward added and saved');
  };

  const handleDeleteWard = (idx: number) => {
    if (!canEdit) return;
    const updated = wards.filter((_, i) => i !== idx);
    setWards(updated);
    handleSaveAll(procedures, samples, orders, updated, designations);
    showMsg('Ward removed');
  };

  const handleSaveEditWard = (idx: number) => {
    const trimmed = editingWardVal.trim();
    if (!trimmed) return;
    const updated = [...wards];
    updated[idx] = trimmed;
    setWards(updated);
    setEditingWardIdx(null);
    handleSaveAll(procedures, samples, orders, updated, designations);
    showMsg('Ward updated');
  };

  // Requester Designations handlers
  const handleAddDesignation = () => {
    const trimmed = newDesignation.trim();
    if (!trimmed) return;
    if (designations.includes(trimmed)) {
      showMsg('Designation already exists', 'error');
      return;
    }
    const updated = [...designations, trimmed];
    setDesignations(updated);
    setNewDesignation('');
    handleSaveAll(procedures, samples, orders, wards, updated);
    showMsg('New designation added and saved');
  };

  const handleDeleteDesignation = (idx: number) => {
    if (!canEdit) return;
    const updated = designations.filter((_, i) => i !== idx);
    setDesignations(updated);
    handleSaveAll(procedures, samples, orders, wards, updated);
    showMsg('Designation removed');
  };

  const handleSaveEditDesignation = (idx: number) => {
    const trimmed = editingDesignationVal.trim();
    if (!trimmed) return;
    const updated = [...designations];
    updated[idx] = trimmed;
    setDesignations(updated);
    setEditingDesignationIdx(null);
    handleSaveAll(procedures, samples, orders, wards, updated);
    showMsg('Designation updated');
  };

  // Orders handlers
  const currentOrdersList =
    orders[selectedOrderProc] ||
    DEFAULT_REQUISITION_ORDERS[selectedOrderProc] ||
    DEFAULT_REQUISITION_ORDERS['Others'] ||
    [];

  const handleAddOrderItem = () => {
    const trimmed = newOrderItem.trim();
    if (!trimmed) return;
    const updatedProcOrders = [...currentOrdersList, trimmed];
    const updatedOrders = { ...orders, [selectedOrderProc]: updatedProcOrders };
    setOrders(updatedOrders);
    setNewOrderItem('');
    handleSaveAll(procedures, samples, updatedOrders, wards, designations);
    showMsg('New order step added and saved');
  };

  const handleDeleteOrderItem = (orderIdx: number) => {
    if (!canEdit) return;
    const updatedProcOrders = currentOrdersList.filter((_, i) => i !== orderIdx);
    const updatedOrders = { ...orders, [selectedOrderProc]: updatedProcOrders };
    setOrders(updatedOrders);
    handleSaveAll(procedures, samples, updatedOrders, wards, designations);
    showMsg('Order step removed');
  };

  const handleSaveEditOrderItem = (orderIdx: number) => {
    const trimmed = editingOrderVal.trim();
    if (!trimmed) return;
    const updatedProcOrders = [...currentOrdersList];
    updatedProcOrders[orderIdx] = trimmed;
    const updatedOrders = { ...orders, [selectedOrderProc]: updatedProcOrders };
    setOrders(updatedOrders);
    setEditingOrderIdx(null);
    handleSaveAll(procedures, samples, updatedOrders, wards, designations);
    showMsg('Order step updated');
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Loading requisition settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Requisition Form Settings</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure procedure options, specimen analysis tests, hospital wards, requester designations, and generic pre-procedure orders. Drag handles to reorder; use sort buttons to order alphabetically.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Row 1: Procedure Options & Samples to Send */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Procedure Options */}
        <div className="card flex flex-col justify-between">
          <div className="card-body flex flex-col justify-between h-full">
            <div>
              {/* Perfectly aligned heading row: Icon + Title + Count tag on left, Sort on right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, minHeight: 28, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <FiLayers style={{ color: 'var(--color-accent)', flexShrink: 0 }} size={18} />
                  <span
                    className="font-semibold text-gray-900 dark:text-gray-100 truncate"
                    style={{ fontSize: 16, lineHeight: '20px', margin: 0, padding: 0 }}
                  >
                    Procedure Options
                  </span>
                  <span
                    style={{
                      backgroundColor: 'var(--color-accent-light, rgba(59, 130, 246, 0.12))',
                      color: 'var(--color-accent)',
                      borderColor: 'var(--color-accent)',
                      borderWidth: 1,
                      borderStyle: 'solid',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '0 7px',
                      borderRadius: 9999,
                      height: 20,
                      lineHeight: '18px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxSizing: 'border-box',
                    }}
                    title={`${procedures.length} items`}
                  >
                    {procedures.length}
                  </span>
                </div>

                {canEdit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-gray-500)', fontWeight: 600, margin: 0, padding: 0, lineHeight: '20px' }}>Sort:</span>
                    <button
                      type="button"
                      onClick={() => handleSort('procedures', 'asc')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '0 8px', height: 22, lineHeight: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Sort A to Z"
                    >
                      A→Z
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort('procedures', 'desc')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '0 8px', height: 22, lineHeight: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Sort Z to A"
                    >
                      Z→A
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Dropdown choices displayed for the requested IR procedure. Drag handles to reorder.
              </p>

              {/* List */}
              <div className="space-y-2 mb-4 max-h-72 overflow-y-auto pr-1">
                {procedures.map((proc, idx) => {
                  const isDragging = dragSource?.section === 'procedures' && dragSource?.index === idx;
                  const isDragOver = dragTarget?.section === 'procedures' && dragTarget?.index === idx;

                  return (
                    <div
                      key={idx}
                      onDragOver={e => handleDragOver(e, 'procedures', idx)}
                      onDrop={e => handleDrop(e, 'procedures', idx)}
                      className={`flex items-center justify-between p-2.5 rounded transition-all ${
                        isDragOver
                          ? 'border-2 border-dashed'
                          : 'bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      } ${isDragging ? 'opacity-40 scale-[0.98]' : ''}`}
                      style={{
                        borderColor: isDragOver ? 'var(--color-accent)' : undefined,
                        backgroundColor: isDragOver ? 'var(--color-accent-light)' : undefined,
                      }}
                    >
                      {editingProcedureIdx === idx ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <input
                            type="text"
                            className="form-input text-sm py-1 flex-1"
                            value={editingProcedureVal}
                            onChange={e => setEditingProcedureVal(e.target.value)}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEditProcedure(idx)}
                            className="text-green-600 hover:text-green-700 p-1"
                            title="Save"
                          >
                            <FiCheck size={16} />
                          </button>
                          <button
                            onClick={() => setEditingProcedureIdx(null)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                            title="Cancel"
                          >
                            <FiX size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                            {canEdit && (
                              <div
                                draggable
                                onDragStart={e => handleDragStart(e, 'procedures', idx)}
                                onDragEnd={handleDragEnd}
                                className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 flex items-center select-none flex-shrink-0"
                                style={{ color: 'var(--color-gray-400)', transition: 'color 0.15s ease' }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-accent)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-gray-400)')}
                                title="Drag handle: click and drag to reorder"
                              >
                                <MdDragIndicator size={17} />
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{proc}</span>
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => {
                                  setEditingProcedureIdx(idx);
                                  setEditingProcedureVal(proc);
                                }}
                                className="text-blue-500 hover:text-blue-700 p-1"
                                title="Edit"
                              >
                                <FiEdit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteProcedure(idx)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Delete"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add input */}
            {canEdit ? (
              <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Add new procedure..."
                  value={newProcedure}
                  onChange={e => setNewProcedure(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddProcedure()}
                  className="form-input text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddProcedure}
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                  disabled={!newProcedure.trim()}
                >
                  <FiPlus size={15} /> Add
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Editing requires editSettings permission</p>
            )}
          </div>
        </div>

        {/* Section 2: Samples for Analysis */}
        <div className="card flex flex-col justify-between">
          <div className="card-body flex flex-col justify-between h-full">
            <div>
              {/* Perfectly aligned heading row: Icon + Title + Count tag on left, Sort on right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, minHeight: 28, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <FiFileText style={{ color: 'var(--color-accent)', flexShrink: 0 }} size={18} />
                  <span
                    className="font-semibold text-gray-900 dark:text-gray-100 truncate"
                    style={{ fontSize: 16, lineHeight: '20px', margin: 0, padding: 0 }}
                  >
                    Samples to Send (Analysis Types)
                  </span>
                  <span
                    style={{
                      backgroundColor: 'var(--color-accent-light, rgba(59, 130, 246, 0.12))',
                      color: 'var(--color-accent)',
                      borderColor: 'var(--color-accent)',
                      borderWidth: 1,
                      borderStyle: 'solid',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '0 7px',
                      borderRadius: 9999,
                      height: 20,
                      lineHeight: '18px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxSizing: 'border-box',
                    }}
                    title={`${samples.length} items`}
                  >
                    {samples.length}
                  </span>
                </div>

                {canEdit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-gray-500)', fontWeight: 600, margin: 0, padding: 0, lineHeight: '20px' }}>Sort:</span>
                    <button
                      type="button"
                      onClick={() => handleSort('samples', 'asc')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '0 8px', height: 22, lineHeight: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Sort A to Z"
                    >
                      A→Z
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort('samples', 'desc')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '0 8px', height: 22, lineHeight: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Sort Z to A"
                    >
                      Z→A
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Checkbox choices for routine fluid, microbiology, molecular, or histopathology tests. Drag handles to reorder.
              </p>

              {/* List */}
              <div className="space-y-2 mb-4 max-h-72 overflow-y-auto pr-1">
                {samples.map((sample, idx) => {
                  const isDragging = dragSource?.section === 'samples' && dragSource?.index === idx;
                  const isDragOver = dragTarget?.section === 'samples' && dragTarget?.index === idx;

                  return (
                    <div
                      key={idx}
                      onDragOver={e => handleDragOver(e, 'samples', idx)}
                      onDrop={e => handleDrop(e, 'samples', idx)}
                      className={`flex items-center justify-between p-2.5 rounded transition-all ${
                        isDragOver
                          ? 'border-2 border-dashed'
                          : 'bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      } ${isDragging ? 'opacity-40 scale-[0.98]' : ''}`}
                      style={{
                        borderColor: isDragOver ? 'var(--color-accent)' : undefined,
                        backgroundColor: isDragOver ? 'var(--color-accent-light)' : undefined,
                      }}
                    >
                      {editingSampleIdx === idx ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <input
                            type="text"
                            className="form-input text-sm py-1 flex-1"
                            value={editingSampleVal}
                            onChange={e => setEditingSampleVal(e.target.value)}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEditSample(idx)}
                            className="text-green-600 hover:text-green-700 p-1"
                            title="Save"
                          >
                            <FiCheck size={16} />
                          </button>
                          <button
                            onClick={() => setEditingSampleIdx(null)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                            title="Cancel"
                          >
                            <FiX size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                            {canEdit && (
                              <div
                                draggable
                                onDragStart={e => handleDragStart(e, 'samples', idx)}
                                onDragEnd={handleDragEnd}
                                className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 flex items-center select-none flex-shrink-0"
                                style={{ color: 'var(--color-gray-400)', transition: 'color 0.15s ease' }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-accent)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-gray-400)')}
                                title="Drag handle: click and drag to reorder"
                              >
                                <MdDragIndicator size={17} />
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{sample}</span>
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => {
                                  setEditingSampleIdx(idx);
                                  setEditingSampleVal(sample);
                                }}
                                className="text-blue-500 hover:text-blue-700 p-1"
                                title="Edit"
                              >
                                <FiEdit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteSample(idx)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Delete"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add input */}
            {canEdit ? (
              <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Add new analysis test..."
                  value={newSample}
                  onChange={e => setNewSample(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSample()}
                  className="form-input text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddSample}
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                  disabled={!newSample.trim()}
                >
                  <FiPlus size={15} /> Add
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Editing requires editSettings permission</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Wards List & Requester Designations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 3: Wards List */}
        <div className="card flex flex-col justify-between">
          <div className="card-body flex flex-col justify-between h-full">
            <div>
              {/* Perfectly aligned heading row: Icon + Title + Count tag on left, Sort on right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, minHeight: 28, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <FiMapPin style={{ color: 'var(--color-accent)', flexShrink: 0 }} size={18} />
                  <span
                    className="font-semibold text-gray-900 dark:text-gray-100 truncate"
                    style={{ fontSize: 16, lineHeight: '20px', margin: 0, padding: 0 }}
                  >
                    Wards List
                  </span>
                  <span
                    style={{
                      backgroundColor: 'var(--color-accent-light, rgba(59, 130, 246, 0.12))',
                      color: 'var(--color-accent)',
                      borderColor: 'var(--color-accent)',
                      borderWidth: 1,
                      borderStyle: 'solid',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '0 7px',
                      borderRadius: 9999,
                      height: 20,
                      lineHeight: '18px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxSizing: 'border-box',
                    }}
                    title={`${wards.length} items`}
                  >
                    {wards.length}
                  </span>
                </div>

                {canEdit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-gray-500)', fontWeight: 600, margin: 0, padding: 0, lineHeight: '20px' }}>Sort:</span>
                    <button
                      type="button"
                      onClick={() => handleSort('wards', 'asc')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '0 8px', height: 22, lineHeight: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Sort A to Z"
                    >
                      A→Z
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort('wards', 'desc')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '0 8px', height: 22, lineHeight: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Sort Z to A"
                    >
                      Z→A
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Hospital wards and units available for auto-suggestion in IP procedure requisitions. Drag handles to reorder.
              </p>

              {/* List */}
              <div className="space-y-2 mb-4 max-h-72 overflow-y-auto pr-1">
                {wards.map((ward, idx) => {
                  const isDragging = dragSource?.section === 'wards' && dragSource?.index === idx;
                  const isDragOver = dragTarget?.section === 'wards' && dragTarget?.index === idx;

                  return (
                    <div
                      key={idx}
                      onDragOver={e => handleDragOver(e, 'wards', idx)}
                      onDrop={e => handleDrop(e, 'wards', idx)}
                      className={`flex items-center justify-between p-2.5 rounded transition-all ${
                        isDragOver
                          ? 'border-2 border-dashed'
                          : 'bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      } ${isDragging ? 'opacity-40 scale-[0.98]' : ''}`}
                      style={{
                        borderColor: isDragOver ? 'var(--color-accent)' : undefined,
                        backgroundColor: isDragOver ? 'var(--color-accent-light)' : undefined,
                      }}
                    >
                      {editingWardIdx === idx ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <input
                            type="text"
                            className="form-input text-sm py-1 flex-1"
                            value={editingWardVal}
                            onChange={e => setEditingWardVal(e.target.value)}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEditWard(idx)}
                            className="text-green-600 hover:text-green-700 p-1"
                            title="Save"
                          >
                            <FiCheck size={16} />
                          </button>
                          <button
                            onClick={() => setEditingWardIdx(null)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                            title="Cancel"
                          >
                            <FiX size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                            {canEdit && (
                              <div
                                draggable
                                onDragStart={e => handleDragStart(e, 'wards', idx)}
                                onDragEnd={handleDragEnd}
                                className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 flex items-center select-none flex-shrink-0"
                                style={{ color: 'var(--color-gray-400)', transition: 'color 0.15s ease' }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-accent)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-gray-400)')}
                                title="Drag handle: click and drag to reorder"
                              >
                                <MdDragIndicator size={17} />
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{ward}</span>
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => {
                                  setEditingWardIdx(idx);
                                  setEditingWardVal(ward);
                                }}
                                className="text-blue-500 hover:text-blue-700 p-1"
                                title="Edit"
                              >
                                <FiEdit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteWard(idx)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Delete"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add input */}
            {canEdit ? (
              <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Add new ward (e.g. Ward 4B, ICU)..."
                  value={newWard}
                  onChange={e => setNewWard(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddWard()}
                  className="form-input text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddWard}
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                  disabled={!newWard.trim()}
                >
                  <FiPlus size={15} /> Add
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Editing requires editSettings permission</p>
            )}
          </div>
        </div>

        {/* Section 4: Requester Designations */}
        <div className="card flex flex-col justify-between">
          <div className="card-body flex flex-col justify-between h-full">
            <div>
              {/* Perfectly aligned heading row: Icon + Title + Count tag on left, Sort on right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, minHeight: 28, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <FiUserCheck style={{ color: 'var(--color-accent)', flexShrink: 0 }} size={18} />
                  <span
                    className="font-semibold text-gray-900 dark:text-gray-100 truncate"
                    style={{ fontSize: 16, lineHeight: '20px', margin: 0, padding: 0 }}
                  >
                    Requester Designations
                  </span>
                  <span
                    style={{
                      backgroundColor: 'var(--color-accent-light, rgba(59, 130, 246, 0.12))',
                      color: 'var(--color-accent)',
                      borderColor: 'var(--color-accent)',
                      borderWidth: 1,
                      borderStyle: 'solid',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '0 7px',
                      borderRadius: 9999,
                      height: 20,
                      lineHeight: '18px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxSizing: 'border-box',
                    }}
                    title={`${designations.length} items`}
                  >
                    {designations.length}
                  </span>
                </div>

                {canEdit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-gray-500)', fontWeight: 600, margin: 0, padding: 0, lineHeight: '20px' }}>Sort:</span>
                    <button
                      type="button"
                      onClick={() => handleSort('designations', 'asc')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '0 8px', height: 22, lineHeight: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Sort A to Z"
                    >
                      A→Z
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort('designations', 'desc')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '0 8px', height: 22, lineHeight: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Sort Z to A"
                    >
                      Z→A
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Staff designations available for auto-suggestion in the requisition slip requester section. Drag handles to reorder.
              </p>

              {/* List */}
              <div className="space-y-2 mb-4 max-h-72 overflow-y-auto pr-1">
                {designations.map((desig, idx) => {
                  const isDragging = dragSource?.section === 'designations' && dragSource?.index === idx;
                  const isDragOver = dragTarget?.section === 'designations' && dragTarget?.index === idx;

                  return (
                    <div
                      key={idx}
                      onDragOver={e => handleDragOver(e, 'designations', idx)}
                      onDrop={e => handleDrop(e, 'designations', idx)}
                      className={`flex items-center justify-between p-2.5 rounded transition-all ${
                        isDragOver
                          ? 'border-2 border-dashed'
                          : 'bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      } ${isDragging ? 'opacity-40 scale-[0.98]' : ''}`}
                      style={{
                        borderColor: isDragOver ? 'var(--color-accent)' : undefined,
                        backgroundColor: isDragOver ? 'var(--color-accent-light)' : undefined,
                      }}
                    >
                      {editingDesignationIdx === idx ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <input
                            type="text"
                            className="form-input text-sm py-1 flex-1"
                            value={editingDesignationVal}
                            onChange={e => setEditingDesignationVal(e.target.value)}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEditDesignation(idx)}
                            className="text-green-600 hover:text-green-700 p-1"
                            title="Save"
                          >
                            <FiCheck size={16} />
                          </button>
                          <button
                            onClick={() => setEditingDesignationIdx(null)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                            title="Cancel"
                          >
                            <FiX size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                            {canEdit && (
                              <div
                                draggable
                                onDragStart={e => handleDragStart(e, 'designations', idx)}
                                onDragEnd={handleDragEnd}
                                className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 flex items-center select-none flex-shrink-0"
                                style={{ color: 'var(--color-gray-400)', transition: 'color 0.15s ease' }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-accent)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-gray-400)')}
                                title="Drag handle: click and drag to reorder"
                              >
                                <MdDragIndicator size={17} />
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{desig}</span>
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => {
                                  setEditingDesignationIdx(idx);
                                  setEditingDesignationVal(desig);
                                }}
                                className="text-blue-500 hover:text-blue-700 p-1"
                                title="Edit"
                              >
                                <FiEdit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteDesignation(idx)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Delete"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add input */}
            {canEdit ? (
              <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Add new designation (e.g. Staff Nurse, DMO)..."
                  value={newDesignation}
                  onChange={e => setNewDesignation(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddDesignation()}
                  className="form-input text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddDesignation}
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                  disabled={!newDesignation.trim()}
                >
                  <FiPlus size={15} /> Add
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Editing requires editSettings permission</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Generic Pre-Procedure Orders by Procedure */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              {/* Perfectly aligned heading row: Icon + Title + Count tag */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <FiCheckSquare style={{ color: 'var(--color-accent)', flexShrink: 0 }} size={18} />
                <span
                  className="font-semibold text-gray-900 dark:text-gray-100"
                  style={{ fontSize: 16, lineHeight: '20px', margin: 0, padding: 0 }}
                >
                  Generic Pre-Procedure Orders (Staff Checklist)
                </span>
                <span
                  style={{
                    backgroundColor: 'var(--color-accent-light, rgba(59, 130, 246, 0.12))',
                    color: 'var(--color-accent)',
                    borderColor: 'var(--color-accent)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '0 7px',
                    borderRadius: 9999,
                    height: 20,
                    lineHeight: '18px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                  title={`${currentOrdersList.length} checklist items for ${selectedOrderProc}`}
                >
                  {currentOrdersList.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-0">
                Standard prep instructions shown to requesting staff nurses/DMOs upon case submission and reviewable on procedure cards. Drag handles to reorder checklist steps.
              </p>
            </div>

            {/* Procedure Selector Pill Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-500)', marginRight: 2 }}>
                Procedure:
              </span>
              {procedures.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setSelectedOrderProc(p);
                    setEditingOrderIdx(null);
                  }}
                  className={`px-3 py-1 text-xs rounded-full font-bold transition-all ${
                    selectedOrderProc === p
                      ? 'btn btn-primary btn-sm shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List for selected procedure */}
          <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--color-gray-200)', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-gray-700)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: '18px' }}>
                  Orders for: <span style={{ color: 'var(--color-accent)' }}>{selectedOrderProc}</span>
                </span>
                <span
                  style={{
                    backgroundColor: 'var(--color-accent-light, rgba(59, 130, 246, 0.12))',
                    color: 'var(--color-accent)',
                    borderColor: 'var(--color-accent)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '0 6px',
                    borderRadius: 9999,
                    height: 18,
                    lineHeight: '16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  {currentOrdersList.length} items
                </span>
              </div>

              {canEdit && currentOrdersList.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--color-gray-500)', fontWeight: 600, margin: 0, padding: 0, lineHeight: '18px' }}>Sort:</span>
                  <button
                    type="button"
                    onClick={() => handleSort('orders', 'asc')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 10.5, padding: '0 7px', height: 20, lineHeight: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Sort A to Z"
                  >
                    A→Z
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSort('orders', 'desc')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 10.5, padding: '0 7px', height: 20, lineHeight: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Sort Z to A"
                  >
                    Z→A
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 mb-4">
              {currentOrdersList.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 italic">
                  No generic orders configured for {selectedOrderProc}. Add checklist points below.
                </div>
              ) : (
                currentOrdersList.map((orderText, idx) => {
                  const isDragging = dragSource?.section === 'orders' && dragSource?.index === idx;
                  const isDragOver = dragTarget?.section === 'orders' && dragTarget?.index === idx;

                  return (
                    <div
                      key={idx}
                      onDragOver={e => handleDragOver(e, 'orders', idx)}
                      onDrop={e => handleDrop(e, 'orders', idx)}
                      className={`flex items-start justify-between gap-2 p-2.5 rounded transition-all ${
                        isDragOver
                          ? 'border-2 border-dashed'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      } ${isDragging ? 'opacity-40 scale-[0.98]' : ''}`}
                      style={{
                        borderColor: isDragOver ? 'var(--color-accent)' : undefined,
                        backgroundColor: isDragOver ? 'var(--color-accent-light)' : undefined,
                      }}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        {canEdit && (
                          <div
                            draggable
                            onDragStart={e => handleDragStart(e, 'orders', idx)}
                            onDragEnd={handleDragEnd}
                            className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 mt-0.5 flex items-center select-none flex-shrink-0"
                            style={{ color: 'var(--color-gray-400)', transition: 'color 0.15s ease' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-accent)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-gray-400)')}
                            title="Drag handle: click and drag to reorder checklist step"
                          >
                            <MdDragIndicator size={17} />
                          </div>
                        )}
                        <span
                          style={{ color: 'var(--color-accent)' }}
                          className="text-xs font-bold mt-0.5 min-w-[20px] flex-shrink-0"
                        >
                          {idx + 1}.
                        </span>
                      </div>

                      {editingOrderIdx === idx ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            className="form-input text-xs py-1 flex-1"
                            value={editingOrderVal}
                            onChange={e => setEditingOrderVal(e.target.value)}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEditOrderItem(idx)}
                            className="text-green-600 hover:text-green-700 p-1"
                            title="Save"
                          >
                            <FiCheck size={15} />
                          </button>
                          <button
                            onClick={() => setEditingOrderIdx(null)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                            title="Cancel"
                          >
                            <FiX size={15} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs text-gray-800 dark:text-gray-200 flex-1 leading-relaxed">
                            {orderText}
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => {
                                  setEditingOrderIdx(idx);
                                  setEditingOrderVal(orderText);
                                }}
                                className="text-blue-500 hover:text-blue-700 p-1"
                                title="Edit Order"
                              >
                                <FiEdit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteOrderItem(idx)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Delete Order"
                              >
                                <FiTrash2 size={13} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Order Input */}
            {canEdit ? (
              <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  placeholder={`Add new order for ${selectedOrderProc}... (e.g. NPO status, CBC, PT/INR)`}
                  value={newOrderItem}
                  onChange={e => setNewOrderItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddOrderItem()}
                  className="form-input text-xs flex-1 py-1.5"
                />
                <button
                  type="button"
                  onClick={handleAddOrderItem}
                  className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs py-1.5"
                  disabled={!newOrderItem.trim()}
                >
                  <FiPlus size={14} /> Add Order
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Editing requires editSettings permission</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
