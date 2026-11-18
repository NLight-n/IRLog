import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import NavBar from '../components/layout/NavBar';
import { useTheme } from '../lib/theme/ThemeContext';
import { useAppSettings } from './_app';
import BottomSheetModal from '../components/common/BottomSheetModal';
import {
  FiEdit2,
  FiTrash2,
  FiEye,
  FiSearch,
  FiCalendar,
  FiFileText,
  FiActivity,
  FiSend,
  FiRotateCcw,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiFilter,
  FiPlus,
  FiMinus,
  FiChevronDown,
  FiChevronUp,
  FiList,
  FiCheckSquare,
} from 'react-icons/fi';
import { DEFAULT_REQUISITION_ORDERS } from './api/settings/index';

const DESIGNATIONS = ['Staff Nurse', 'DMO', 'CMO', 'Consultant'];
const URGENCIES = ['Routine', 'Urgent', 'Emergency'];

// Status color theme helper:
// submitted - purple, accepted - blue, done - green, cancelled - red, Not done - yellow
const getStatusTheme = (status: string) => {
  switch (status) {
    case 'Submitted':
      return {
        tagBg: '#f3e8ff',
        tagText: '#6b21a8',
        tagBorder: '#d8b4fe',
        borderColor: '#8b5cf6', // purple
        label: 'Submitted',
      };
    case 'Accepted':
      return {
        tagBg: '#dbeafe',
        tagText: '#1e40af',
        tagBorder: '#bfdbfe',
        borderColor: '#3b82f6', // blue
        label: 'Accepted',
      };
    case 'Done':
      return {
        tagBg: '#dcfce7',
        tagText: '#15803d',
        tagBorder: '#bbf7d0',
        borderColor: '#10b981', // green
        label: 'Done',
      };
    case 'Cancelled':
      return {
        tagBg: '#fee2e2',
        tagText: '#b91c1c',
        tagBorder: '#fecaca',
        borderColor: '#ef4444', // red
        label: 'Cancelled',
      };
    case 'NotDone':
      return {
        tagBg: '#fef9c3',
        tagText: '#854d0e',
        tagBorder: '#fef08a',
        borderColor: '#eab308', // yellow
        label: 'Not Done',
      };
    default:
      return {
        tagBg: '#f3f4f6',
        tagText: '#374151',
        tagBorder: '#e5e7eb',
        borderColor: '#9ca3af',
        label: status || 'Unknown',
      };
  }
};

export default function RequisitionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { appHeading, appSubheading, appLogo } = useAppSettings();

  const navbarRef = useRef<HTMLElement>(null);
  const [navbarHeight, setNavbarHeight] = useState(60);

  const perms = (session?.user as any)?.permissions || {};
  const isRequisitionOnly = !!perms.requisitionOnly;
  const canManageAppointments = !!(perms.editApptCard || perms.manageUsers);

  // Data state
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [inactiveRequests, setInactiveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSearch, setActiveSearch] = useState('');
  const [inactiveSearch, setInactiveSearch] = useState('');
  const [inactiveDateFilter, setInactiveDateFilter] = useState<'last1' | 'last3' | 'last7' | 'last30' | 'all'>('last7');

  // Mobile Form Collapsed / Expanded state (collapsed by default on mobile)
  const [isMobileFormExpanded, setIsMobileFormExpanded] = useState(false);

  // Card & Orders Accordion Expansion states
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [expandedOrdersId, setExpandedOrdersId] = useState<number | null>(null);

  // Generic orders map from settings
  const [genericOrdersMap, setGenericOrdersMap] = useState<Record<string, string[]>>(DEFAULT_REQUISITION_ORDERS);

  // Pop-up modal after case submission
  const [submittedCaseData, setSubmittedCaseData] = useState<{ request: any; orders: string[] } | null>(null);

  // Dropdown options loaded from Settings
  const [procedureOptions, setProcedureOptions] = useState<string[]>([
    'Biopsy',
    'Pigtail',
    'Aspiration-diagnostic',
    'Aspiration-therapeutic',
    'Others',
  ]);
  const [sampleOptions, setSampleOptions] = useState<string[]>([
    'Routine fluid analysis',
    'Culture & Sensitivity',
    'GeneXpert',
  ]);

  // Modal states for View Details & Delete
  const [viewDetailsItem, setViewDetailsItem] = useState<any | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<any | null>(null);

  // Physicians list from Settings for Referring Consultant typable dropdown
  const [physiciansList, setPhysiciansList] = useState<any[]>([]);
  const [consultantDropdownOpen, setConsultantDropdownOpen] = useState(false);
  const [consultantHighlightIndex, setConsultantHighlightIndex] = useState<number>(-1);
  const consultantInputRef = useRef<HTMLInputElement>(null);
  const consultantDropdownRef = useRef<HTMLDivElement>(null);

  // Wards list from Settings for Ward typable dropdown
  const [wardsList, setWardsList] = useState<string[]>([
    'Ward 4B',
    'Ward 3A',
    'Ward 2C',
    'ICU',
    'CCU',
    'MICU',
    'SICU',
    'Casualty / ER',
    'Day Care',
    'Private Ward',
    'Semi-Private',
    'General Ward',
  ]);
  const [wardDropdownOpen, setWardDropdownOpen] = useState(false);
  const [wardHighlightIndex, setWardHighlightIndex] = useState<number>(-1);
  const wardInputRef = useRef<HTMLInputElement>(null);
  const wardDropdownRef = useRef<HTMLDivElement>(null);

  // Designations list from Settings for Designation typable dropdown
  const [designationsList, setDesignationsList] = useState<string[]>([
    'Staff Nurse',
    'DMO',
    'CMO',
    'Consultant',
    'Resident',
    'Fellow',
    'Physician Assistant',
  ]);
  const [designationDropdownOpen, setDesignationDropdownOpen] = useState(false);
  const [designationHighlightIndex, setDesignationHighlightIndex] = useState<number>(-1);
  const designationInputRef = useRef<HTMLInputElement>(null);
  const designationDropdownRef = useRef<HTMLDivElement>(null);

  // Form State
  const initialFormState = {
    hospitalID: '',
    patientName: '',
    patientAge: '',
    patientSex: '',
    patientType: 'IP',
    ward: '',
    referringConsultant: '',
    procedure: 'Biopsy',
    otherProcedure: '',
    fromWhere: '',
    samplesAnalysis: [] as string[],
    otherSamples: '',
    requesterDesignation: 'Staff Nurse',
    requesterName: '',
    requesterContact: '',
    urgency: 'Routine',
    clinicalNotes: '',
  };
  const [formData, setFormData] = useState(initialFormState);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Measure navbar height
  useEffect(() => {
    if (navbarRef.current) {
      setNavbarHeight(navbarRef.current.offsetHeight);
    }
  }, [navbarRef.current]);

  // Load settings & requests
  const loadRequests = async () => {
    try {
      const [resActive, resInactive] = await Promise.all([
        fetch('/api/requisitions?category=active'),
        fetch('/api/requisitions?category=inactive'),
      ]);
      if (resActive.ok) {
        const dataActive = await resActive.json();
        setActiveRequests(dataActive);
      }
      if (resInactive.ok) {
        const dataInactive = await resInactive.json();
        setInactiveRequests(dataInactive);
      }
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const [resSettings, resPhysicians] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/procedures/physician'),
      ]);
      if (resSettings.ok) {
        const data = await resSettings.json();
        if (Array.isArray(data.requisitionProcedures) && data.requisitionProcedures.length > 0) {
          setProcedureOptions(data.requisitionProcedures);
        }
        if (Array.isArray(data.requisitionSamples) && data.requisitionSamples.length > 0) {
          const loadedSamples = [...data.requisitionSamples];
          if (!loadedSamples.some(s => s.toLowerCase().trim() === 'no analysis needed')) {
            loadedSamples.push('No analysis needed');
          }
          setSampleOptions(loadedSamples);
        }
        if (Array.isArray(data.requisitionWards) && data.requisitionWards.length > 0) {
          setWardsList(data.requisitionWards);
        }
        if (Array.isArray(data.requisitionDesignations) && data.requisitionDesignations.length > 0) {
          setDesignationsList(data.requisitionDesignations);
        }
        if (data.requisitionOrders && typeof data.requisitionOrders === 'object') {
          setGenericOrdersMap(data.requisitionOrders);
        }
      }
      if (resPhysicians.ok) {
        const physicians = await resPhysicians.json();
        if (Array.isArray(physicians)) {
          setPhysiciansList(physicians);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        consultantDropdownRef.current &&
        !consultantDropdownRef.current.contains(target) &&
        consultantInputRef.current &&
        !consultantInputRef.current.contains(target)
      ) {
        setConsultantDropdownOpen(false);
      }
      if (
        wardDropdownRef.current &&
        !wardDropdownRef.current.contains(target) &&
        wardInputRef.current &&
        !wardInputRef.current.contains(target)
      ) {
        setWardDropdownOpen(false);
      }
      if (
        designationDropdownRef.current &&
        !designationDropdownRef.current.contains(target) &&
        designationInputRef.current &&
        !designationInputRef.current.contains(target)
      ) {
        setDesignationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll highlighted consultant into view during keyboard navigation
  useEffect(() => {
    if (consultantDropdownOpen && consultantHighlightIndex >= 0 && consultantDropdownRef.current) {
      const items = consultantDropdownRef.current.querySelectorAll('.consultant-dropdown-item');
      if (items[consultantHighlightIndex]) {
        (items[consultantHighlightIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [consultantHighlightIndex, consultantDropdownOpen]);

  // Auto-scroll highlighted ward into view during keyboard navigation
  useEffect(() => {
    if (wardDropdownOpen && wardHighlightIndex >= 0 && wardDropdownRef.current) {
      const items = wardDropdownRef.current.querySelectorAll('.ward-dropdown-item');
      if (items[wardHighlightIndex]) {
        (items[wardHighlightIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [wardHighlightIndex, wardDropdownOpen]);

  // Auto-scroll highlighted designation into view during keyboard navigation
  useEffect(() => {
    if (designationDropdownOpen && designationHighlightIndex >= 0 && designationDropdownRef.current) {
      const items = designationDropdownRef.current.querySelectorAll('.designation-dropdown-item');
      if (items[designationHighlightIndex]) {
        (items[designationHighlightIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [designationHighlightIndex, designationDropdownOpen]);

  // Filter physicians for Referring Consultant dropdown dynamically on typing
  const filteredPhysicians = useMemo(() => {
    const q = (formData.referringConsultant || '').toLowerCase().trim();
    if (!q) return physiciansList;
    return physiciansList.filter((p: any) =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.department && p.department.toLowerCase().includes(q))
    );
  }, [physiciansList, formData.referringConsultant]);

  // Filter wards for Ward typable dropdown dynamically on typing
  const filteredWards = useMemo(() => {
    const q = (formData.ward || '').toLowerCase().trim();
    if (!q) return wardsList;
    return wardsList.filter(w => w.toLowerCase().includes(q));
  }, [wardsList, formData.ward]);

  // Filter designations for Requester Designation typable dropdown dynamically on typing
  const filteredDesignations = useMemo(() => {
    const q = (formData.requesterDesignation || '').toLowerCase().trim();
    if (!q) return designationsList;
    return designationsList.filter(d => d.toLowerCase().includes(q));
  }, [designationsList, formData.requesterDesignation]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (status === 'authenticated') {
      loadRequests();
      loadSettings();
    }
  }, [status]);

  // Hospital ID Lookup on Blur
  const handleHospitalIDLookup = async (idVal: string) => {
    const trimmed = idVal.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/procedures/patient-lookup?patientID=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const p = await res.json();
        if (p && p.patientName) {
          setFormData(prev => ({
            ...prev,
            patientName: prev.patientName || p.patientName || '',
            patientAge: prev.patientAge || (p.patientAge != null ? String(p.patientAge) : ''),
            patientSex: prev.patientSex || p.patientSex || '',
            patientType: prev.patientType || p.status || 'IP',
          }));
        }
      }
    } catch {}
  };

  // Check if current form has user data typed
  const isFormDirty = () => {
    return (
      formData.hospitalID.trim() !== '' ||
      formData.patientName.trim() !== '' ||
      formData.fromWhere.trim() !== '' ||
      formData.referringConsultant.trim() !== '' ||
      formData.clinicalNotes.trim() !== '' ||
      formData.ward.trim() !== ''
    );
  };

  // Toggle sample checkbox
  const toggleSample = (sample: string) => {
    const isNoAnalysis = sample.toLowerCase().trim() === 'no analysis needed';
    setFormData(prev => {
      if (isNoAnalysis) {
        const alreadyHasNoAnalysis = prev.samplesAnalysis.some(s => s.toLowerCase().trim() === 'no analysis needed');
        if (alreadyHasNoAnalysis) {
          return { ...prev, samplesAnalysis: [] };
        } else {
          return { ...prev, samplesAnalysis: ['No analysis needed'], otherSamples: '' };
        }
      } else {
        const cleaned = prev.samplesAnalysis.filter(s => s.toLowerCase().trim() !== 'no analysis needed');
        const exists = cleaned.includes(sample);
        return {
          ...prev,
          samplesAnalysis: exists ? cleaned.filter(s => s !== sample) : [...cleaned, sample],
        };
      }
    });
  };

  const isNoAnalysisSelected = formData.samplesAnalysis.some(s => s.toLowerCase().trim() === 'no analysis needed');

  // Clear Form Handler
  const handleClearForm = () => {
    if (isFormDirty()) {
      if (!window.confirm('Clear all fields on the requisition slip?')) return;
    }
    setFormData(initialFormState);
    setFormError('');
    setFormSuccess('');
    setIsMobileFormExpanded(false);
  };

  // Cancel Edit Handler
  const handleCancelEdit = () => {
    setEditingItem(null);
    setFormData(initialFormState);
    setFormError('');
    setFormSuccess('');
    setIsMobileFormExpanded(false);
  };

  // Start Editing Request
  const handleStartEdit = (item: any) => {
    if (item.status !== 'Submitted') {
      alert('Only submitted requests can be edited. This request has already been accepted or processed.');
      return;
    }
    if (isFormDirty() && (!editingItem || editingItem.id !== item.id)) {
      const confirmOverwrite = window.confirm(
        'The requisition slip currently contains unsaved data. Do you want to overwrite it with this request?'
      );
      if (!confirmOverwrite) return;
    }

    setEditingItem(item);
    setFormData({
      hospitalID: item.hospitalID || '',
      patientName: item.patientName || '',
      patientAge: item.patientAge != null ? String(item.patientAge) : '',
      patientSex: item.patientSex || '',
      patientType: item.patientType || 'IP',
      ward: item.ward || '',
      referringConsultant: item.referringConsultant || '',
      procedure: item.procedure || 'Biopsy',
      otherProcedure: item.otherProcedure || '',
      fromWhere: item.fromWhere || '',
      samplesAnalysis: Array.isArray(item.samplesAnalysis) ? item.samplesAnalysis : [],
      otherSamples: item.otherSamples || '',
      requesterDesignation: item.requesterDesignation || 'Staff Nurse',
      requesterName: item.requesterName || '',
      requesterContact: item.requesterContact || '',
      urgency: item.urgency || 'Routine',
      clinicalNotes: item.clinicalNotes || '',
    });
    setFormError('');
    setFormSuccess('');

    // On mobile, expand the form and scroll to it
    setIsMobileFormExpanded(true);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Submit Request Handler (Create or Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hospitalID.trim() || !formData.patientName.trim() || !formData.fromWhere.trim()) {
      setFormError('Hospital ID, Patient Name, and Lesion/Site (From where) are required.');
      return;
    }
    if (formData.patientType === 'IP' && !formData.ward.trim()) {
      setFormError('Ward is required for Inpatient (IP) procedure requests.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    setFormSuccess('');

    try {
      const isEdit = !!editingItem;
      const method = isEdit ? 'PATCH' : 'POST';
      const endpoint = isEdit ? `/api/requisitions/${editingItem.id}` : '/api/requisitions';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to submit request');
      }

      const resData = await res.json();

      setFormSuccess(isEdit ? 'Requisition changes saved successfully!' : 'Procedure request submitted successfully!');
      setTimeout(() => setFormSuccess(''), 3000);

      // On new case submission: show pop-up with Generic Orders!
      if (!isEdit && resData) {
        const procName = resData.procedure || formData.procedure;
        const ordersList =
          resData.genericOrders ||
          genericOrdersMap[procName] ||
          genericOrdersMap['Others'] ||
          DEFAULT_REQUISITION_ORDERS[procName] ||
          DEFAULT_REQUISITION_ORDERS['Others'] ||
          [];
        setSubmittedCaseData({
          request: resData,
          orders: ordersList,
        });
      }

      // Reset form to blank create state
      setEditingItem(null);
      setFormData(initialFormState);

      loadRequests();
      window.dispatchEvent(new CustomEvent('irlog:requisitions-updated'));

      // On mobile, collapse the form so user sees the active queue right below
      setIsMobileFormExpanded(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save requisition');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Request Handler
  const handleDeleteRequest = async () => {
    if (!deleteConfirmItem) return;
    try {
      const res = await fetch(`/api/requisitions/${deleteConfirmItem.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete request');
      }
      setDeleteConfirmItem(null);
      // If we were editing the deleted item, reset form
      if (editingItem && editingItem.id === deleteConfirmItem.id) {
        setEditingItem(null);
        setFormData(initialFormState);
      }
      loadRequests();
      window.dispatchEvent(new CustomEvent('irlog:requisitions-updated'));
    } catch (err: any) {
      alert(err.message || 'Failed to delete requisition');
    }
  };

  // Resubmit Request Handler (Creates a fresh new request in Active column, keeping existing intact)
  const [resubmitting, setResubmitting] = useState(false);

  const handleResubmitRequest = async (item: any) => {
    if (!item) return;
    setResubmitting(true);
    try {
      const payload = {
        patientName: item.patientName,
        patientAge: item.patientAge,
        patientSex: item.patientSex,
        hospitalID: item.hospitalID,
        patientType: item.patientType || 'IP',
        ward: item.ward,
        referringConsultant: item.referringConsultant || undefined,
        procedure: item.procedure,
        otherProcedure: item.otherProcedure,
        fromWhere: item.fromWhere,
        samplesAnalysis: item.samplesAnalysis || [],
        otherSamples: item.otherSamples,
        requesterDesignation: item.requesterDesignation,
        requesterName: item.requesterName,
        requesterContact: item.requesterContact,
        urgency: item.urgency || 'Routine',
        clinicalNotes: item.clinicalNotes,
      };

      const res = await fetch('/api/requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to resubmit request');
      }

      const created = await res.json();

      // Close the view details modal
      setViewDetailsItem(null);

      // Reload both queues
      await loadRequests();
      window.dispatchEvent(new CustomEvent('irlog:requisitions-updated'));

      // Automatically populate the form in Edit mode for the newly created request
      // so the user can modify any details immediately without re-typing!
      handleStartEdit(created);

      // On mobile, expand the form so they see it right away
      setIsMobileFormExpanded(true);

      setFormSuccess(`Request #${created.id} resubmitted to Active column! You can modify details below.`);
      setTimeout(() => setFormSuccess(''), 5000);
    } catch (err: any) {
      alert(err.message || 'Error resubmitting request');
    } finally {
      setResubmitting(false);
    }
  };

  // Filter Active Requests
  const filteredActiveRequests = useMemo(() => {
    if (!activeSearch.trim()) return activeRequests;
    const q = activeSearch.toLowerCase();
    return activeRequests.filter(item => {
      return (
        item.patientName?.toLowerCase().includes(q) ||
        item.hospitalID?.toLowerCase().includes(q) ||
        item.procedure?.toLowerCase().includes(q) ||
        item.fromWhere?.toLowerCase().includes(q) ||
        item.ward?.toLowerCase().includes(q) ||
        item.requesterName?.toLowerCase().includes(q)
      );
    });
  }, [activeRequests, activeSearch]);

  // Filter Inactive Requests by Date and Search
  const filteredInactiveRequests = useMemo(() => {
    let list = inactiveRequests;

    // 1. Date filter
    if (inactiveDateFilter !== 'all') {
      const now = Date.now();
      const msMap: Record<string, number> = {
        last1: 1 * 24 * 60 * 60 * 1000,
        last3: 3 * 24 * 60 * 60 * 1000,
        last7: 7 * 24 * 60 * 60 * 1000,
        last30: 30 * 24 * 60 * 60 * 1000,
      };
      const maxAge = msMap[inactiveDateFilter] || 7 * 24 * 60 * 60 * 1000;
      list = list.filter(item => {
        const itemTime = new Date(item.updatedAt || item.createdAt).getTime();
        return now - itemTime <= maxAge;
      });
    }

    // 2. Search query filter
    if (inactiveSearch.trim()) {
      const q = inactiveSearch.toLowerCase();
      list = list.filter(item => {
        return (
          item.patientName?.toLowerCase().includes(q) ||
          item.hospitalID?.toLowerCase().includes(q) ||
          item.procedure?.toLowerCase().includes(q) ||
          item.fromWhere?.toLowerCase().includes(q) ||
          item.ward?.toLowerCase().includes(q) ||
          item.cancelledReason?.toLowerCase().includes(q) ||
          item.notDoneReason?.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [inactiveRequests, inactiveDateFilter, inactiveSearch]);

  return (
    <div className={`min-h-screen bg-gray-50${theme === 'dark' ? ' dark' : ''}`}>
      <NavBar
        ref={navbarRef}
        user={session?.user}
        onToggleTheme={setTheme}
        theme={theme}
        appHeading={appHeading}
        appSubheading={appSubheading}
        appLogo={appLogo}
      />

      <div
        className="page-content-mobile px-3 sm:px-4"
        style={{
          paddingTop: navbarHeight + 8,
          paddingBottom: 24,
          width: '100%',
          maxWidth: 'min(1600px, 98vw)',
          margin: '0 auto',
        }}
      >
        {/* Top Page Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: 'var(--color-gray-900)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Interventional Radiology Requisition Management
          </h1>
          <p style={{ fontSize: 12, color: 'var(--color-gray-500)', margin: 0 }}>
            Submit procedure requests, monitor active queues, and review completed or cancelled requisitions.
          </p>
        </div>

        {/* Mobile Toggle Button for Request Form (Visible ONLY on mobile < 768px) */}
        <div className="requisition-mobile-toggle-wrapper" style={{ marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setIsMobileFormExpanded(prev => !prev)}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 10,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
              background: editingItem ? '#f59e0b' : 'var(--color-accent)',
              borderColor: editingItem ? '#d97706' : 'var(--color-accent)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {editingItem ? <FiEdit2 size={16} /> : (isMobileFormExpanded ? <FiMinus size={16} /> : <FiPlus size={16} />)}
              <span>
                {editingItem
                  ? (isMobileFormExpanded ? `Editing Request #${editingItem.id}` : `Resume Editing #${editingItem.id}`)
                  : (isMobileFormExpanded ? 'Collapse IR Procedure Form' : 'New IR Procedure request')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, opacity: 0.9 }}>
              <span>{isMobileFormExpanded ? 'Collapse' : 'Tap to expand'}</span>
              {isMobileFormExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
            </div>
          </button>
        </div>

        {/* --- Main Container: Desktop: 1/2 (Form) & 1/2 (Wrapper with 1/4 Active & 1/4 Inactive) --- */}
        <div
          className="requisition-main-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 16,
            width: '100%',
            height: 'calc(100vh - 140px)',
            minHeight: 600,
          }}
        >
          {/* ========================================================================= */}
          {/* COLUMN 1: IR Procedure Requisition Form (1/2 of width on desktop)         */}
          {/* ========================================================================= */}
          <div
            className={`requisition-col-form ${!isMobileFormExpanded ? 'mobile-collapsed' : ''}`}
            style={{
              minWidth: 0,
              borderColor: editingItem ? 'var(--color-warning)' : 'var(--color-gray-300)',
            }}
          >
            {/* Header: Requisition Slip Style */}
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--color-gray-200)',
                background: editingItem ? 'rgba(245, 158, 11, 0.12)' : 'var(--color-gray-100)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    background: editingItem ? '#f59e0b' : 'var(--color-accent)',
                    color: '#fff',
                    padding: '5px',
                    borderRadius: 6,
                    display: 'flex',
                  }}
                >
                  <FiFileText size={16} />
                </div>
                <div>
                  <h2 style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--color-gray-900)', margin: 0 }}>
                    {editingItem ? 'Edit Procedure Requisition' : 'IR Procedure Requisition Form'}
                  </h2>
                  <div style={{ fontSize: 11, color: 'var(--color-gray-500)', marginTop: 1 }}>
                    Digital Requisition Slip
                  </div>
                </div>
              </div>

              {editingItem ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: '#fef3c7',
                      color: '#92400e',
                      padding: '2px 8px',
                      borderRadius: 12,
                    }}
                  >
                    Editing #{editingItem.id}
                  </span>
                  <button
                    onClick={handleCancelEdit}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)' }}
                    title="Cancel edit"
                  >
                    <FiX size={16} />
                  </button>
                </div>
              ) : (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: 'var(--color-accent-light, #dbeafe)',
                    color: 'var(--color-accent, #1e40af)',
                    padding: '2px 8px',
                    borderRadius: 12,
                  }}
                >
                  New Request
                </span>
              )}
            </div>

            {/* Error & Success Banners */}
            {formError && (
              <div
                style={{
                  margin: '8px 12px 0 12px',
                  padding: '8px 12px',
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  fontSize: 11.5,
                  borderRadius: 6,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <FiAlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}
            {formSuccess && (
              <div
                style={{
                  margin: '8px 12px 0 12px',
                  padding: '8px 12px',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  color: '#166534',
                  fontSize: 11.5,
                  borderRadius: 6,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <FiCheckCircle size={15} style={{ flexShrink: 0 }} />
                <span>{formSuccess}</span>
              </div>
            )}

            {/* Scrollable Form Body */}
            <form
              id="requisition-slip-form"
              onSubmit={handleSubmitForm}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                fontSize: 12,
              }}
            >
              {/* Section 1: Patient Identification */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--color-gray-200)',
                  background: 'var(--color-gray-100)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  1. Patient Identification
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                      Hospital ID / MRN *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.hospitalID}
                      onChange={e => setFormData({ ...formData, hospitalID: e.target.value })}
                      onBlur={e => handleHospitalIDLookup(e.target.value)}
                      placeholder="e.g. 102456"
                      className="form-input"
                      style={{ fontSize: 13, padding: '7px 10px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                      Patient Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.patientName}
                      onChange={e => setFormData({ ...formData, patientName: e.target.value })}
                      placeholder="Patient Name"
                      className="form-input"
                      style={{ fontSize: 13, padding: '7px 10px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                      Age
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="130"
                      value={formData.patientAge}
                      onChange={e => setFormData({ ...formData, patientAge: e.target.value })}
                      placeholder="Age"
                      className="form-input"
                      style={{ fontSize: 13, padding: '7px 8px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                      Sex
                    </label>
                    <select
                      value={formData.patientSex}
                      onChange={e => setFormData({ ...formData, patientSex: e.target.value })}
                      className="form-input"
                      style={{ fontSize: 13, padding: '7px 6px' }}
                    >
                      <option value="">Sex</option>
                      <option value="M">M</option>
                      <option value="F">F</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                      Type *
                    </label>
                    <select
                      value={formData.patientType}
                      onChange={e => setFormData({ ...formData, patientType: e.target.value })}
                      className="form-input"
                      style={{ fontSize: 13, padding: '7px 6px', fontWeight: 700, color: 'var(--color-accent)' }}
                    >
                      <option value="IP">IP</option>
                      <option value="OP">OP</option>
                    </select>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                      Ward {formData.patientType === 'IP' ? '*' : ''}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        ref={wardInputRef}
                        type="text"
                        required={formData.patientType === 'IP'}
                        value={formData.ward}
                        onChange={e => {
                          setFormData({ ...formData, ward: e.target.value });
                          setWardDropdownOpen(true);
                          setWardHighlightIndex(-1);
                        }}
                        onFocus={() => {
                          setWardDropdownOpen(true);
                          setWardHighlightIndex(-1);
                        }}
                        onKeyDown={e => {
                          if (!wardDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                            e.preventDefault();
                            setWardDropdownOpen(true);
                            setWardHighlightIndex(0);
                            return;
                          }
                          if (!wardDropdownOpen || filteredWards.length === 0) return;

                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setWardHighlightIndex(prev => (prev < filteredWards.length - 1 ? prev + 1 : 0));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setWardHighlightIndex(prev => (prev > 0 ? prev - 1 : filteredWards.length - 1));
                          } else if (e.key === 'Enter') {
                            if (wardHighlightIndex >= 0 && wardHighlightIndex < filteredWards.length) {
                              e.preventDefault();
                              e.stopPropagation();
                              setFormData(prev => ({ ...prev, ward: filteredWards[wardHighlightIndex] }));
                              setWardDropdownOpen(false);
                              setWardHighlightIndex(-1);
                            }
                          } else if (e.key === ' ' && wardHighlightIndex >= 0 && wardHighlightIndex < filteredWards.length) {
                            e.preventDefault();
                            e.stopPropagation();
                            setFormData(prev => ({ ...prev, ward: filteredWards[wardHighlightIndex] }));
                            setWardDropdownOpen(false);
                            setWardHighlightIndex(-1);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setWardDropdownOpen(false);
                            setWardHighlightIndex(-1);
                          }
                        }}
                        placeholder={formData.patientType === 'IP' ? 'e.g. Ward 4B' : 'OPD'}
                        className="form-input"
                        style={{ fontSize: 13, padding: '7px 24px 7px 8px', width: '100%' }}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setWardDropdownOpen(prev => !prev);
                          setWardHighlightIndex(-1);
                          wardInputRef.current?.focus();
                        }}
                        tabIndex={-1}
                        style={{
                          position: 'absolute',
                          right: 4,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-gray-400)',
                          padding: 2,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Toggle Wards list"
                      >
                        <FiChevronDown size={14} />
                      </button>
                    </div>
                    {wardDropdownOpen && filteredWards.length > 0 && (
                      <div
                        ref={wardDropdownRef}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 60,
                          marginTop: 4,
                          maxHeight: 180,
                          overflowY: 'auto',
                          background: 'var(--color-white)',
                          border: '1px solid var(--color-gray-300)',
                          borderRadius: 6,
                          boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
                        }}
                      >
                        {filteredWards.map((w, idx) => {
                          const isHighlighted = wardHighlightIndex === idx;
                          return (
                            <div
                              key={w}
                              className={`ward-dropdown-item ${isHighlighted ? 'selected-accent' : ''}`}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, ward: w }));
                                setWardDropdownOpen(false);
                                setWardHighlightIndex(-1);
                              }}
                              style={{
                                padding: '7px 10px',
                                cursor: 'pointer',
                                fontSize: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid var(--color-gray-100)',
                                color: isHighlighted ? 'var(--color-accent)' : 'var(--color-gray-900)',
                                background: isHighlighted ? 'var(--color-accent-light, rgba(59, 130, 246, 0.12))' : 'transparent',
                                transition: 'background-color 0.1s ease',
                              }}
                              onMouseEnter={() => setWardHighlightIndex(idx)}
                            >
                              <span style={{ fontWeight: isHighlighted ? 700 : 500 }}>{w}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Referring Consultant (Typable dynamic filter dropdown) */}
                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                    Referring Consultant
                  </label>
                  <input
                    ref={consultantInputRef}
                    type="text"
                    value={formData.referringConsultant}
                    onChange={e => {
                      setFormData({ ...formData, referringConsultant: e.target.value });
                      setConsultantDropdownOpen(true);
                      setConsultantHighlightIndex(-1);
                    }}
                    onFocus={() => {
                      setConsultantDropdownOpen(true);
                      setConsultantHighlightIndex(-1);
                    }}
                    onKeyDown={e => {
                      if (!consultantDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                        e.preventDefault();
                        setConsultantDropdownOpen(true);
                        setConsultantHighlightIndex(0);
                        return;
                      }
                      if (!consultantDropdownOpen || filteredPhysicians.length === 0) return;

                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setConsultantHighlightIndex(prev => (prev < filteredPhysicians.length - 1 ? prev + 1 : 0));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setConsultantHighlightIndex(prev => (prev > 0 ? prev - 1 : filteredPhysicians.length - 1));
                      } else if (e.key === 'Enter') {
                        if (consultantHighlightIndex >= 0 && consultantHighlightIndex < filteredPhysicians.length) {
                          e.preventDefault();
                          e.stopPropagation();
                          const selected = filteredPhysicians[consultantHighlightIndex];
                          setFormData(prev => ({ ...prev, referringConsultant: selected.name }));
                          setConsultantDropdownOpen(false);
                          setConsultantHighlightIndex(-1);
                        }
                      } else if (e.key === ' ' && consultantHighlightIndex >= 0 && consultantHighlightIndex < filteredPhysicians.length) {
                        e.preventDefault();
                        e.stopPropagation();
                        const selected = filteredPhysicians[consultantHighlightIndex];
                        setFormData(prev => ({ ...prev, referringConsultant: selected.name }));
                        setConsultantDropdownOpen(false);
                        setConsultantHighlightIndex(-1);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setConsultantDropdownOpen(false);
                        setConsultantHighlightIndex(-1);
                      }
                    }}
                    placeholder="Type to search or enter consultant name..."
                    className="form-input"
                    style={{ fontSize: 13, padding: '7px 10px', width: '100%' }}
                    autoComplete="off"
                  />
                  {consultantDropdownOpen && filteredPhysicians.length > 0 && (
                    <div
                      ref={consultantDropdownRef}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        marginTop: 4,
                        maxHeight: 180,
                        overflowY: 'auto',
                        background: 'var(--color-white)',
                        border: '1px solid var(--color-gray-300)',
                        borderRadius: 6,
                        boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
                      }}
                    >
                      {filteredPhysicians.map((p: any, idx: number) => {
                        const isHighlighted = consultantHighlightIndex === idx;
                        return (
                          <div
                            key={p.physicianID || p.id || p.name}
                            className={`consultant-dropdown-item ${isHighlighted ? 'selected-accent' : ''}`}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, referringConsultant: p.name }));
                              setConsultantDropdownOpen(false);
                              setConsultantHighlightIndex(-1);
                            }}
                            style={{
                              padding: '7px 10px',
                              cursor: 'pointer',
                              fontSize: 12,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderBottom: '1px solid var(--color-gray-100)',
                              color: isHighlighted ? 'var(--color-accent)' : 'var(--color-gray-900)',
                              background: isHighlighted ? 'var(--color-accent-light, rgba(59, 130, 246, 0.12))' : 'transparent',
                              transition: 'background-color 0.1s ease',
                            }}
                            onMouseEnter={() => setConsultantHighlightIndex(idx)}
                          >
                            <span style={{ fontWeight: isHighlighted ? 700 : 600 }}>{p.name}</span>
                            {p.department && (
                              <span style={{ fontSize: 10.5, color: isHighlighted ? 'var(--color-accent)' : 'var(--color-gray-500)', fontStyle: 'italic' }}>
                                {p.department}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Procedure & Target Location */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--color-gray-200)',
                  background: 'var(--color-gray-100)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  2. Procedure & Lesion Site
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: formData.procedure === 'Others' ? '1fr 1fr' : '1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                      Procedure Type *
                    </label>
                    <select
                      value={formData.procedure}
                      onChange={e => setFormData({ ...formData, procedure: e.target.value })}
                      className="form-input"
                      style={{ fontSize: 13, padding: '7px 10px', fontWeight: 700, color: 'var(--color-accent)' }}
                    >
                      {procedureOptions.map(p => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.procedure === 'Others' && (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                        Specify Other Procedure *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.otherProcedure}
                        onChange={e => setFormData({ ...formData, otherProcedure: e.target.value })}
                        placeholder="e.g. Nephrostomy, TJLB"
                        className="form-input"
                        style={{ fontSize: 13, padding: '7px 10px' }}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                    From where? (Organ / Lesion / Site) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fromWhere}
                    onChange={e => setFormData({ ...formData, fromWhere: e.target.value })}
                    placeholder="e.g. Liver abscess, Right lung mass, Pelvic collection"
                    className="form-input"
                    style={{ fontSize: 13, padding: '7px 10px', fontWeight: 500 }}
                  />
                </div>

                {/* Samples Analysis Checkboxes */}
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--color-gray-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block' }}>
                      Samples to be sent for what analysis:
                    </label>
                    {isNoAnalysisSelected && (
                      <span style={{ fontSize: 11, color: 'var(--color-gray-500)', fontStyle: 'italic' }}>
                        (Other tests disabled)
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                    {sampleOptions.map(s => {
                      const isNoAnalysisOption = s.toLowerCase().trim() === 'no analysis needed';
                      const checked = formData.samplesAnalysis.some(item => item.toLowerCase().trim() === s.toLowerCase().trim());
                      const isOtherDisabled = isNoAnalysisSelected && !isNoAnalysisOption;

                      return (
                        <label
                          key={s}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            padding: '6px 8px',
                            borderRadius: 6,
                            border: checked ? '1px solid var(--color-accent)' : '1px solid var(--color-gray-300)',
                            background: checked ? 'var(--color-accent-light, #eff6ff)' : 'var(--color-white)',
                            cursor: isOtherDisabled ? 'not-allowed' : 'pointer',
                            opacity: isOtherDisabled ? 0.4 : 1,
                            fontSize: 12,
                            userSelect: 'none',
                            pointerEvents: isOtherDisabled ? 'none' : 'auto',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isOtherDisabled}
                            onChange={() => toggleSample(s)}
                            style={{ margin: 0, cursor: isOtherDisabled ? 'not-allowed' : 'pointer' }}
                          />
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontWeight: checked ? 700 : 400,
                              color: isOtherDisabled ? 'var(--color-gray-400)' : undefined,
                            }}
                          >
                            {s}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    value={isNoAnalysisSelected ? '' : formData.otherSamples}
                    disabled={isNoAnalysisSelected}
                    onChange={e => setFormData({ ...formData, otherSamples: e.target.value })}
                    placeholder={isNoAnalysisSelected ? 'Disabled (No analysis needed selected)' : 'Additional tests (e.g. Cytology, ADA, Gram stain)...'}
                    className="form-input"
                    style={{
                      fontSize: 12.5,
                      padding: '6px 10px',
                      marginTop: 8,
                      opacity: isNoAnalysisSelected ? 0.45 : 1,
                      cursor: isNoAnalysisSelected ? 'not-allowed' : 'text',
                      backgroundColor: isNoAnalysisSelected ? 'var(--color-gray-100)' : undefined,
                    }}
                  />
                </div>
              </div>

              {/* Section 3: Requester Information */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--color-gray-200)',
                  background: 'var(--color-gray-100)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  3. Requester Particulars & Urgency
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                      Designation *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        ref={designationInputRef}
                        type="text"
                        required
                        value={formData.requesterDesignation}
                        onChange={e => {
                          setFormData({ ...formData, requesterDesignation: e.target.value });
                          setDesignationDropdownOpen(true);
                          setDesignationHighlightIndex(-1);
                        }}
                        onFocus={() => {
                          setDesignationDropdownOpen(true);
                          setDesignationHighlightIndex(-1);
                        }}
                        onKeyDown={e => {
                          if (!designationDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                            e.preventDefault();
                            setDesignationDropdownOpen(true);
                            setDesignationHighlightIndex(0);
                            return;
                          }
                          if (!designationDropdownOpen || filteredDesignations.length === 0) return;

                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setDesignationHighlightIndex(prev => (prev < filteredDesignations.length - 1 ? prev + 1 : 0));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setDesignationHighlightIndex(prev => (prev > 0 ? prev - 1 : filteredDesignations.length - 1));
                          } else if (e.key === 'Enter') {
                            if (designationHighlightIndex >= 0 && designationHighlightIndex < filteredDesignations.length) {
                              e.preventDefault();
                              e.stopPropagation();
                              setFormData(prev => ({ ...prev, requesterDesignation: filteredDesignations[designationHighlightIndex] }));
                              setDesignationDropdownOpen(false);
                              setDesignationHighlightIndex(-1);
                            }
                          } else if (e.key === ' ' && designationHighlightIndex >= 0 && designationHighlightIndex < filteredDesignations.length) {
                            e.preventDefault();
                            e.stopPropagation();
                            setFormData(prev => ({ ...prev, requesterDesignation: filteredDesignations[designationHighlightIndex] }));
                            setDesignationDropdownOpen(false);
                            setDesignationHighlightIndex(-1);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setDesignationDropdownOpen(false);
                            setDesignationHighlightIndex(-1);
                          }
                        }}
                        placeholder="e.g. Staff Nurse, DMO"
                        className="form-input"
                        style={{ fontSize: 13, padding: '7px 24px 7px 8px', width: '100%', fontWeight: 600 }}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setDesignationDropdownOpen(prev => !prev);
                          setDesignationHighlightIndex(-1);
                          designationInputRef.current?.focus();
                        }}
                        tabIndex={-1}
                        style={{
                          position: 'absolute',
                          right: 4,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-gray-400)',
                          padding: 2,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Toggle Designations list"
                      >
                        <FiChevronDown size={14} />
                      </button>
                    </div>
                    {designationDropdownOpen && filteredDesignations.length > 0 && (
                      <div
                        ref={designationDropdownRef}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 60,
                          marginTop: 4,
                          maxHeight: 180,
                          overflowY: 'auto',
                          background: 'var(--color-white)',
                          border: '1px solid var(--color-gray-300)',
                          borderRadius: 6,
                          boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
                        }}
                      >
                        {filteredDesignations.map((d, idx) => {
                          const isHighlighted = designationHighlightIndex === idx;
                          return (
                            <div
                              key={d}
                              className={`designation-dropdown-item ${isHighlighted ? 'selected-accent' : ''}`}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, requesterDesignation: d }));
                                setDesignationDropdownOpen(false);
                                setDesignationHighlightIndex(-1);
                              }}
                              style={{
                                padding: '7px 10px',
                                cursor: 'pointer',
                                fontSize: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid var(--color-gray-100)',
                                color: isHighlighted ? 'var(--color-accent)' : 'var(--color-gray-900)',
                                background: isHighlighted ? 'var(--color-accent-light, rgba(59, 130, 246, 0.12))' : 'transparent',
                                transition: 'background-color 0.1s ease',
                              }}
                              onMouseEnter={() => setDesignationHighlightIndex(idx)}
                            >
                              <span style={{ fontWeight: isHighlighted ? 700 : 600 }}>{d}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                      Name
                    </label>
                    <input
                      type="text"
                      value={formData.requesterName}
                      onChange={e => setFormData({ ...formData, requesterName: e.target.value })}
                      placeholder="Requester Name"
                      className="form-input"
                      style={{ fontSize: 13, padding: '7px 8px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                      Phone / Ext
                    </label>
                    <input
                      type="text"
                      value={formData.requesterContact}
                      onChange={e => setFormData({ ...formData, requesterContact: e.target.value })}
                      placeholder="Contact No"
                      className="form-input"
                      style={{ fontSize: 13, padding: '7px 8px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                      Urgency
                    </label>
                    <select
                      value={formData.urgency}
                      onChange={e => setFormData({ ...formData, urgency: e.target.value })}
                      className="form-input"
                      style={{ fontSize: 13, padding: '7px 8px', fontWeight: 700 }}
                    >
                      {URGENCIES.map(u => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                      Clinical Indication / History
                    </label>
                    <input
                      type="text"
                      value={formData.clinicalNotes}
                      onChange={e => setFormData({ ...formData, clinicalNotes: e.target.value })}
                      placeholder="Brief history, coag status, allergy..."
                      className="form-input"
                      style={{ fontSize: 13, padding: '7px 10px' }}
                    />
                  </div>
                </div>
              </div>
            </form>

            {/* Fixed Bottom Action Buttons (Non-scrollable, always pinned below box) */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--color-gray-200)',
                background: 'var(--color-white)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 12,
                flexShrink: 0,
                boxShadow: '0 -2px 6px rgba(0,0,0,0.03)',
              }}
            >
              {editingItem ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 13, padding: '7px 16px' }}
                    disabled={formSubmitting}
                  >
                    <FiX size={15} style={{ marginRight: 4 }} /> Cancel
                  </button>
                  <button
                    type="submit"
                    form="requisition-slip-form"
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: 13, fontWeight: 700, padding: '7px 20px' }}
                    disabled={formSubmitting}
                  >
                    <FiSend size={15} style={{ marginRight: 4 }} /> {formSubmitting ? 'Saving...' : 'Save changes'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 13, padding: '7px 16px' }}
                    disabled={formSubmitting}
                  >
                    <FiRotateCcw size={15} style={{ marginRight: 4 }} /> Clear
                  </button>
                  <button
                    type="submit"
                    form="requisition-slip-form"
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: 13, fontWeight: 700, padding: '7px 20px' }}
                    disabled={formSubmitting}
                  >
                    <FiSend size={15} style={{ marginRight: 4 }} /> {formSubmitting ? 'Submitting...' : 'Submit request'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* WRAPPER FOR ACTIVE & INACTIVE COLUMNS                                     */}
          {/* Desktop: 1/2 of screen (split into 1/4 Active & 1/4 Inactive)             */}
          {/* Mobile: 2 columns below the button/form (50% Active & 50% Inactive)       */}
          {/* ========================================================================= */}
          <div className="requisition-columns-wrapper">
            {/* COLUMN 2: Active Requests Column (Highlighted border strictly following theme AccentColor) */}
            <div className="requisition-col-active" style={{ minWidth: 0 }}>
              {/* Header with Title, Count, & Search */}
              <div
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--color-gray-200)',
                  background: 'var(--color-gray-100)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--color-accent)' }}>Active Requests</span>
                    <span style={{ fontSize: 9.5, background: 'var(--color-accent)', color: 'var(--color-accent-contrast, #fff)', borderRadius: 4, padding: '1px 5px', fontWeight: 800 }}>
                      Active
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      background: 'var(--color-gray-200)',
                      color: 'var(--color-gray-800)',
                      fontWeight: 800,
                      padding: '1px 7px',
                      borderRadius: 10,
                    }}
                  >
                    {activeRequests.length}
                  </span>
                </div>

                {/* Search Box */}
                <div style={{ position: 'relative', width: '100%' }}>
                  <FiSearch style={{ position: 'absolute', left: 7, top: 7, color: 'var(--color-gray-400)' }} size={11} />
                  <input
                    type="text"
                    placeholder="Search patientID and Name"
                    value={activeSearch}
                    onChange={e => setActiveSearch(e.target.value)}
                    className="form-input"
                    style={{ fontSize: 11, padding: '4px 6px 4px 24px', borderRadius: 4, width: '100%' }}
                  />
                </div>
              </div>

            {/* Active Requests List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {loading ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-gray-400)', fontSize: 12 }}>
                  Loading active requests...
                </div>
              ) : filteredActiveRequests.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-gray-400)', fontSize: 12 }}>
                  <FiActivity size={24} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                  <div>No active requests found.</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    {activeSearch ? 'Try different search keywords.' : 'Submitted procedure requests will appear here.'}
                  </div>
                </div>
              ) : (
                filteredActiveRequests.map(req => {
                  const isSubmitted = req.status === 'Submitted';
                  const isAccepted = req.status === 'Accepted';
                  const isBeingEdited = editingItem && editingItem.id === req.id;
                  const isCardExpanded = expandedCardId === req.id;
                  const isOrdersExpanded = expandedOrdersId === req.id;
                  const st = getStatusTheme(req.status);

                  const cardOrders =
                    req.genericOrders ||
                    genericOrdersMap[req.procedure] ||
                    genericOrdersMap['Others'] ||
                    DEFAULT_REQUISITION_ORDERS[req.procedure] ||
                    DEFAULT_REQUISITION_ORDERS['Others'] ||
                    [];

                  return (
                    <div
                      key={req.id}
                      className="appt-card"
                      onMouseEnter={() => setExpandedCardId(req.id)}
                      onMouseLeave={() => setExpandedCardId(null)}
                      onClick={() => setExpandedCardId(prev => (prev === req.id ? null : req.id))}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: isBeingEdited ? '2px solid #8b5cf6' : '1px solid var(--color-gray-300)',
                        borderLeft: `4px solid ${st.borderColor}`,
                        background: isBeingEdited ? 'rgba(139, 92, 246, 0.08)' : 'var(--color-white)',
                        boxShadow: isCardExpanded
                          ? '0 4px 12px rgba(0,0,0,0.1)'
                          : '0 1px 3px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s ease, transform 0.15s ease, background-color 0.2s ease',
                      }}
                    >
                      {/* Row 1: ptName & tag + scheduled date (below Accepted tag) */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--color-gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isCardExpanded ? 'normal' : 'nowrap', flex: 1, minWidth: 0, paddingTop: 1 }}>
                          {req.patientName}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: 6,
                              background: st.tagBg,
                              color: st.tagText,
                              border: `1px solid ${st.tagBorder}`,
                              lineHeight: 1.3,
                            }}
                          >
                            {st.label}
                          </span>
                          {isAccepted && req.scheduledDate && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: '#2563eb',
                                letterSpacing: '-0.01em',
                                lineHeight: 1.2,
                              }}
                              title={`Scheduled for ${new Date(req.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${req.scheduledTime ? ` at ${req.scheduledTime}` : ''}`}
                            >
                              {new Date(req.scheduledDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Row 2: ID, age/sex, IP/OP, ward */}
                      <div style={{ fontSize: 11, color: 'var(--color-gray-500)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 1.5 }}>
                        <span style={{ fontWeight: 600 }}>ID: {req.hospitalID}</span>
                        {(req.patientAge != null || req.patientSex) && (
                          <span>
                            • {req.patientAge ? `${req.patientAge}Y` : ''}
                            {req.patientSex ? `/${req.patientSex}` : ''}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '0px 4px',
                            borderRadius: 3,
                            background: req.patientType === 'IP' ? '#e0e7ff' : '#e5e7eb',
                            color: req.patientType === 'IP' ? '#3730a3' : '#374151',
                          }}
                        >
                          {req.patientType} {req.ward ? `(${req.ward})` : ''}
                        </span>
                      </div>

                      {/* Row 3: [Modality] Procedure type (in AccentColor) - Site (in normal black/white) in single line */}
                      <div style={{ fontSize: 11.5, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isCardExpanded ? 'normal' : 'nowrap', lineHeight: 1.35 }}>
                        {req.modality && (
                          <span style={{ fontWeight: 800, color: 'var(--color-accent)', marginRight: 4 }}>
                            [{req.modality}]
                          </span>
                        )}
                        <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>
                          {req.procedure === 'Others' && req.otherProcedure ? req.otherProcedure : req.procedure}
                        </span>
                        <span style={{ color: 'var(--color-gray-400)', margin: '0 4px' }}>-</span>
                        <span style={{ fontWeight: 500, color: 'var(--color-gray-800)' }}>
                          {req.fromWhere}
                        </span>
                      </div>

                      {/* Row 4 (Compact card): Pre-procedure orders summary badge (NO action buttons in compact view) */}
                      {!isCardExpanded && cardOrders.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 7px',
                              borderRadius: 5,
                              background: 'rgba(59, 130, 246, 0.08)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: 'var(--color-accent)',
                            }}
                          >
                            <FiCheckSquare size={11} />
                            <span>Pre-Procedure Orders ({cardOrders.length})</span>
                          </span>
                        </div>
                      )}

                      {/* Expanded View: shown smoothly on mouseHover / tap */}
                      {isCardExpanded && (
                        <div
                          className="appt-card-expanded"
                          style={{
                            marginTop: 6,
                            paddingTop: 6,
                            borderTop: '1px dashed var(--color-gray-300)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 5,
                            fontSize: 11,
                          }}
                        >
                          {/* Pre-Procedure Orders: automatically shown expanded on hover / tap */}
                          {cardOrders.length > 0 && (
                            <div
                              style={{
                                padding: '6px 8px',
                                borderRadius: 6,
                                background: 'var(--color-gray-50)',
                                border: '1px solid var(--color-gray-300)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                              }}
                            >
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <FiCheckSquare size={12} />
                                <span>Pre-Procedure Orders ({cardOrders.length}):</span>
                              </div>
                              {cardOrders.map((ord: string, i: number) => (
                                <div key={i} style={{ fontSize: 10.5, color: 'var(--color-gray-800)', display: 'flex', alignItems: 'flex-start', gap: 5, lineHeight: 1.35 }}>
                                  <span style={{ fontWeight: 800, color: 'var(--color-accent)', minWidth: 14 }}>{i + 1}.</span>
                                  <span>{ord}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Referring Consultant */}
                          {req.referringConsultant && (
                            <div>
                              <strong style={{ color: 'var(--color-gray-800)' }}>Referring Consultant: </strong>
                              <span style={{ color: 'var(--color-gray-900)', fontWeight: 600 }}>{req.referringConsultant}</span>
                            </div>
                          )}

                          {/* Modality */}
                          {req.modality && (
                            <div>
                              <strong style={{ color: 'var(--color-gray-800)' }}>Modality: </strong>
                              <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>[{req.modality}]</span>
                            </div>
                          )}

                          {/* Samples requested */}
                          {req.samplesAnalysis && req.samplesAnalysis.length > 0 && (
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>Samples: </span>
                              <span style={{ color: 'var(--color-gray-900)' }}>{req.samplesAnalysis.join(', ')}</span>
                              {req.otherSamples && <span style={{ color: 'var(--color-gray-500)', fontStyle: 'italic' }}> ({req.otherSamples})</span>}
                            </div>
                          )}

                          {/* Scheduled Info (if Accepted) */}
                          {isAccepted && req.scheduledDate && (
                            <div style={{ color: 'var(--color-accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <FiCalendar size={12} />
                              <span>
                                Scheduled: {new Date(req.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                {req.scheduledTime && ` at ${req.scheduledTime}`}
                              </span>
                            </div>
                          )}

                          {/* Indication / Notes */}
                          {req.clinicalNotes && (
                            <div>
                              <strong style={{ color: 'var(--color-gray-800)' }}>Indication: </strong>
                              <span style={{ color: 'var(--color-gray-600)' }}>{req.clinicalNotes}</span>
                            </div>
                          )}

                          {/* Urgency */}
                          <div>
                            <strong style={{ color: 'var(--color-gray-800)' }}>Urgency: </strong>
                            <span style={{ fontWeight: 700, color: req.urgency === 'Emergency' ? '#dc2626' : req.urgency === 'Urgent' ? '#d97706' : 'var(--color-gray-700)' }}>
                              {req.urgency || 'Routine'}
                            </span>
                          </div>

                          {/* Footer with Requester Info & Action Buttons (Edit, View Full Slip, Delete) */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--color-gray-200)', marginTop: 2 }}>
                            <span style={{ color: 'var(--color-gray-500)', fontSize: 10 }}>
                              By: <strong style={{ color: 'var(--color-gray-700)' }}>{req.requesterDesignation || 'Staff'}</strong>
                              {req.requesterName ? ` • ${req.requesterName}` : ''}
                              {req.requesterContact ? ` (${req.requesterContact})` : ''}
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {/* Edit button: only in Submitted status */}
                              {isSubmitted && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit(req);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: '1px solid var(--color-gray-300)',
                                    borderRadius: 5,
                                    padding: '2px 6px',
                                    color: 'var(--color-accent)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                  }}
                                  title="Edit request"
                                >
                                  <FiEdit2 size={11} />
                                  <span>Edit</span>
                                </button>
                              )}

                              {/* Full Slip Modal Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewDetailsItem(req);
                                }}
                                className="btn btn-sm btn-secondary"
                                style={{ fontSize: 10, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}
                                title="View full requisition slip"
                              >
                                <FiEye size={11} />
                                <span>Slip</span>
                              </button>

                              {/* Delete button: only if permitted */}
                              {(isSubmitted || (!isRequisitionOnly && canManageAppointments)) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmItem(req);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: '1px solid var(--color-gray-300)',
                                    borderRadius: 5,
                                    padding: '2px 5px',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: 10,
                                  }}
                                  title="Delete request"
                                >
                                  <FiTrash2 size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* COLUMN 3: Inactive Requests Column                                        */}
          {/* ========================================================================= */}
          <div
            className="requisition-col-inactive"
            style={{ minWidth: 0 }}
          >
            {/* Header with Title & Date Filter Dropdown in line */}
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--color-gray-200)',
                background: 'var(--color-gray-50)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--color-gray-900)', whiteSpace: 'nowrap' }}>
                  Inactive Requests
                </span>

                {/* Filter Dropdown in line with heading, no number tag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FiFilter size={11} style={{ color: 'var(--color-gray-400)', flexShrink: 0 }} />
                  <select
                    value={inactiveDateFilter}
                    onChange={e => setInactiveDateFilter(e.target.value as any)}
                    className="form-input"
                    style={{ fontSize: 11, padding: '2px 5px', fontWeight: 600, color: 'var(--color-gray-700)', height: 26 }}
                  >
                    <option value="last1">Last 1 day</option>
                    <option value="last3">Last 3 days</option>
                    <option value="last7">Last 1 week</option>
                    <option value="last30">Last 1 month</option>
                    <option value="all">All time</option>
                  </select>
                </div>
              </div>

              {/* Quick Search */}
              <div style={{ position: 'relative' }}>
                <FiSearch style={{ position: 'absolute', left: 7, top: 7, color: 'var(--color-gray-400)' }} size={11} />
                <input
                  type="text"
                  placeholder="Search patientID and Name"
                  value={inactiveSearch}
                  onChange={e => setInactiveSearch(e.target.value)}
                  className="form-input"
                  style={{ fontSize: 11, padding: '4px 6px 4px 24px', borderRadius: 4, width: '100%' }}
                />
              </div>
            </div>

            {/* Inactive Requests Compact List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {loading ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-gray-400)', fontSize: 11 }}>Loading...</div>
              ) : filteredInactiveRequests.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-gray-400)', fontSize: 11 }}>
                  <FiClock size={20} style={{ margin: '0 auto 6px auto', opacity: 0.4 }} />
                  <div>No inactive requests</div>
                  <div style={{ fontSize: 10, marginTop: 2 }}>for chosen filter.</div>
                </div>
              ) : (
                filteredInactiveRequests.map(req => {
                  const isCardExpanded = expandedCardId === req.id;
                  const st = getStatusTheme(req.status);

                  const cardOrders =
                    req.genericOrders ||
                    genericOrdersMap[req.procedure] ||
                    genericOrdersMap['Others'] ||
                    DEFAULT_REQUISITION_ORDERS[req.procedure] ||
                    DEFAULT_REQUISITION_ORDERS['Others'] ||
                    [];

                  const procDisplayName =
                    req.procedure === 'Others' && req.otherProcedure ? req.otherProcedure : req.procedure;

                  return (
                    <div
                      key={req.id}
                      className="appt-card"
                      onMouseEnter={() => setExpandedCardId(req.id)}
                      onMouseLeave={() => setExpandedCardId(null)}
                      onClick={() => setExpandedCardId(prev => (prev === req.id ? null : req.id))}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--color-gray-300)',
                        borderLeft: `4px solid ${st.borderColor}`,
                        background: 'var(--color-white)',
                        boxShadow: isCardExpanded
                          ? '0 4px 12px rgba(0,0,0,0.1)'
                          : '0 1px 3px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s ease, transform 0.15s ease, background-color 0.2s ease',
                      }}
                    >
                      {/* Row 1: ptName & tag + scheduled date if any */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 13,
                            color: 'var(--color-gray-900)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: isCardExpanded ? 'normal' : 'nowrap',
                            flex: 1,
                            minWidth: 0,
                            paddingTop: 1,
                          }}
                        >
                          {req.patientName}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: 6,
                              background: st.tagBg,
                              color: st.tagText,
                              border: `1px solid ${st.tagBorder}`,
                              lineHeight: 1.3,
                            }}
                          >
                            {st.label}
                          </span>
                          {req.scheduledDate && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: '#2563eb',
                                letterSpacing: '-0.01em',
                                lineHeight: 1.2,
                              }}
                            >
                              {new Date(req.scheduledDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Row 2: ID, age/sex, IP/OP, ward */}
                      <div style={{ fontSize: 11, color: 'var(--color-gray-500)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 1.5 }}>
                        <span style={{ fontWeight: 600 }}>ID: {req.hospitalID}</span>
                        {(req.patientAge != null || req.patientSex) && (
                          <span>
                            • {req.patientAge ? `${req.patientAge}Y` : ''}
                            {req.patientSex ? `/${req.patientSex}` : ''}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '0px 4px',
                            borderRadius: 3,
                            background: req.patientType === 'IP' ? '#e0e7ff' : '#e5e7eb',
                            color: req.patientType === 'IP' ? '#3730a3' : '#374151',
                          }}
                        >
                          {req.patientType} {req.ward ? `(${req.ward})` : ''}
                        </span>
                      </div>

                      {/* Row 3: [Modality] Procedure type (in AccentColor) - Site (in normal black/white) in single line */}
                      <div style={{ fontSize: 11.5, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isCardExpanded ? 'normal' : 'nowrap', lineHeight: 1.35 }}>
                        {req.modality && (
                          <span style={{ fontWeight: 800, color: 'var(--color-accent)', marginRight: 4 }}>
                            [{req.modality}]
                          </span>
                        )}
                        <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>
                          {procDisplayName}
                        </span>
                        <span style={{ color: 'var(--color-gray-400)', margin: '0 4px' }}>-</span>
                        <span style={{ fontWeight: 500, color: 'var(--color-gray-800)' }}>
                          {req.fromWhere}
                        </span>
                      </div>

                      {/* NO buttons or orders row in compact view! */}

                      {/* Expanded View: shown smoothly on mouseHover / tap */}
                      {isCardExpanded && (
                        <div
                          className="appt-card-expanded"
                          style={{
                            marginTop: 6,
                            paddingTop: 6,
                            borderTop: '1px dashed var(--color-gray-300)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 5,
                            fontSize: 11,
                          }}
                        >
                          {(req.cancelledReason || req.notDoneReason) && (
                            <div style={{ color: '#b91c1c', fontWeight: 600, fontSize: 11 }}>
                              <span style={{ textDecoration: 'underline' }}>Reason:</span> {req.cancelledReason || req.notDoneReason}
                            </div>
                          )}

                          {/* Pre-Procedure Orders: expanded automatically on hover/tap */}
                          {cardOrders.length > 0 && (
                            <div
                              style={{
                                padding: '6px 8px',
                                borderRadius: 6,
                                background: 'var(--color-gray-50)',
                                border: '1px solid var(--color-gray-300)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                              }}
                            >
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <FiCheckSquare size={12} />
                                <span>Pre-Procedure Orders ({cardOrders.length}):</span>
                              </div>
                              {cardOrders.map((ord: string, i: number) => (
                                <div key={i} style={{ fontSize: 10.5, color: 'var(--color-gray-800)', display: 'flex', alignItems: 'flex-start', gap: 5, lineHeight: 1.35 }}>
                                  <span style={{ fontWeight: 800, color: 'var(--color-accent)', minWidth: 14 }}>{i + 1}.</span>
                                  <span>{ord}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {req.referringConsultant && (
                            <div>
                              <strong style={{ color: 'var(--color-gray-800)' }}>Referring Consultant: </strong>
                              <span style={{ color: 'var(--color-gray-900)', fontWeight: 600 }}>{req.referringConsultant}</span>
                            </div>
                          )}

                          {req.modality && (
                            <div>
                              <strong style={{ color: 'var(--color-gray-800)' }}>Modality: </strong>
                              <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>[{req.modality}]</span>
                            </div>
                          )}

                          {req.samplesAnalysis && req.samplesAnalysis.length > 0 && (
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>Samples: </span>
                              <span style={{ color: 'var(--color-gray-900)' }}>{req.samplesAnalysis.join(', ')}</span>
                              {req.otherSamples && <span style={{ color: 'var(--color-gray-500)', fontStyle: 'italic' }}> ({req.otherSamples})</span>}
                            </div>
                          )}

                          {req.clinicalNotes && (
                            <div>
                              <strong style={{ color: 'var(--color-gray-800)' }}>Indication: </strong>
                              <span style={{ color: 'var(--color-gray-600)' }}>{req.clinicalNotes}</span>
                            </div>
                          )}

                          <div>
                            <strong style={{ color: 'var(--color-gray-800)' }}>Urgency: </strong>
                            <span style={{ fontWeight: 700, color: req.urgency === 'Emergency' ? '#dc2626' : req.urgency === 'Urgent' ? '#d97706' : 'var(--color-gray-700)' }}>
                              {req.urgency || 'Routine'}
                            </span>
                          </div>

                          {/* Footer with Requester info & Action Buttons (Resubmit, Full Slip, Delete) */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--color-gray-200)', marginTop: 2 }}>
                            <span style={{ color: 'var(--color-gray-500)', fontSize: 10 }}>
                              By: <strong style={{ color: 'var(--color-gray-700)' }}>{req.requesterDesignation || 'Staff'}</strong>
                              {req.requesterName ? ` • ${req.requesterName}` : ''}
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {/* Resubmit button */}
                              <button
                                type="button"
                                disabled={resubmitting}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResubmitRequest(req);
                                }}
                                style={{
                                  background: 'rgba(59, 130, 246, 0.08)',
                                  border: '1px solid var(--color-accent)',
                                  borderRadius: 5,
                                  padding: '2px 7px',
                                  color: 'var(--color-accent)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                }}
                                title="Resubmit as new active request"
                              >
                                <FiRotateCcw size={11} />
                                <span>Resubmit</span>
                              </button>

                              {/* Full Slip Modal Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewDetailsItem(req);
                                }}
                                className="btn btn-sm btn-secondary"
                                style={{ fontSize: 10, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}
                                title="View full requisition slip"
                              >
                                <FiEye size={11} />
                                <span>Slip</span>
                              </button>

                              {/* Delete button (if permitted) */}
                              {(!isRequisitionOnly && canManageAppointments) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmItem(req);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: '1px solid var(--color-gray-300)',
                                    borderRadius: 5,
                                    padding: '2px 5px',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: 10,
                                  }}
                                  title="Delete request"
                                >
                                  <FiTrash2 size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* --- View Details Modal (Read Only) --- */}
      {viewDetailsItem && (
        <BottomSheetModal
          open={!!viewDetailsItem}
          onClose={() => setViewDetailsItem(null)}
          title={`Procedure Request: ${viewDetailsItem.patientName}`}
          maxWidth="560px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
            {/* Status bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--color-gray-100)' }}>
              <span style={{ fontWeight: 700, color: 'var(--color-gray-700)' }}>Status</span>
              {(() => {
                const modalSt = getStatusTheme(viewDetailsItem.status);
                return (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 8,
                      background: modalSt.tagBg,
                      color: modalSt.tagText,
                      border: `1px solid ${modalSt.tagBorder}`,
                    }}
                  >
                    {modalSt.label}
                  </span>
                );
              })()}
            </div>

            {/* Patient Particulars */}
            <div style={{ border: '1px solid var(--color-gray-200)', borderRadius: 8, padding: 10, background: 'var(--color-gray-50)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11.5 }}>
                <div>
                  <span style={{ color: 'var(--color-gray-500)', display: 'block', fontSize: 10 }}>Hospital ID</span>
                  <span style={{ fontWeight: 800, color: 'var(--color-gray-900)' }}>{viewDetailsItem.hospitalID}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-gray-500)', display: 'block', fontSize: 10 }}>Patient Full Name</span>
                  <span style={{ fontWeight: 800, color: 'var(--color-gray-900)' }}>{viewDetailsItem.patientName}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-gray-500)', display: 'block', fontSize: 10 }}>Age / Sex</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>
                    {viewDetailsItem.patientAge ? `${viewDetailsItem.patientAge} Y` : 'N/A'} /{' '}
                    {viewDetailsItem.patientSex || 'N/A'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-gray-500)', display: 'block', fontSize: 10 }}>Admission Type</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>
                    {viewDetailsItem.patientType}{' '}
                    {viewDetailsItem.ward ? `• Ward: ${viewDetailsItem.ward}` : ''}
                  </span>
                </div>
                {viewDetailsItem.referringConsultant && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--color-gray-500)', display: 'block', fontSize: 10 }}>Referring Consultant</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-gray-900)' }}>{viewDetailsItem.referringConsultant}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Procedure Request Info */}
            <div style={{ border: '1px solid var(--color-gray-200)', borderRadius: 8, padding: 10, background: 'var(--color-gray-50)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <span style={{ color: 'var(--color-gray-500)', display: 'block', fontSize: 10 }}>Requested Procedure</span>
                <span style={{ fontWeight: 800, color: 'var(--color-accent)', fontSize: 13 }}>
                  {viewDetailsItem.modality ? `[${viewDetailsItem.modality}] ` : ''}
                  {viewDetailsItem.procedure === 'Others' && viewDetailsItem.otherProcedure
                    ? viewDetailsItem.otherProcedure
                    : viewDetailsItem.procedure}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--color-gray-500)', display: 'block', fontSize: 10 }}>Lesion Site / Location</span>
                <span style={{ fontWeight: 700, color: 'var(--color-gray-900)' }}>{viewDetailsItem.fromWhere}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-gray-500)', display: 'block', fontSize: 10 }}>Specimen Analysis</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                  {viewDetailsItem.samplesAnalysis?.length > 0 ? (
                    viewDetailsItem.samplesAnalysis.map((s: string, i: number) => (
                      <span
                        key={i}
                        style={{
                          background: 'var(--color-gray-200)',
                          color: 'var(--color-gray-800)',
                          padding: '2px 6px',
                          borderRadius: 3,
                          fontSize: 10.5,
                          fontWeight: 600,
                        }}
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: 'var(--color-gray-500)' }}>None specified</span>
                  )}
                </div>
                {viewDetailsItem.otherSamples && (
                  <div style={{ color: 'var(--color-gray-600)', fontStyle: 'italic', fontSize: 11, marginTop: 4 }}>
                    Additional tests: {viewDetailsItem.otherSamples}
                  </div>
                )}
              </div>
            </div>

            {/* Requester & Schedule Info */}
            <div style={{ border: '1px solid var(--color-gray-200)', borderRadius: 8, padding: 10, background: 'var(--color-gray-50)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>
                <span style={{ color: 'var(--color-gray-500)' }}>Requested by: </span>
                <span style={{ fontWeight: 700, color: 'var(--color-gray-800)' }}>
                  {viewDetailsItem.requesterDesignation || 'Staff'}{' '}
                  {viewDetailsItem.requesterName ? `(${viewDetailsItem.requesterName})` : ''}
                </span>
                {viewDetailsItem.requesterContact && (
                  <span style={{ color: 'var(--color-gray-500)', marginLeft: 8 }}>• Contact: {viewDetailsItem.requesterContact}</span>
                )}
              </div>
              <div>
                <span style={{ color: 'var(--color-gray-500)' }}>Urgency: </span>
                <span style={{ fontWeight: 700 }}>{viewDetailsItem.urgency || 'Routine'}</span>
              </div>
              {viewDetailsItem.clinicalNotes && (
                <div>
                  <span style={{ color: 'var(--color-gray-500)' }}>Clinical Notes: </span>
                  <span style={{ color: 'var(--color-gray-800)' }}>{viewDetailsItem.clinicalNotes}</span>
                </div>
              )}
              {viewDetailsItem.scheduledDate && (
                <div style={{ padding: '6px 8px', background: 'var(--color-accent-light, #eff6ff)', color: 'var(--color-accent, #1e40af)', borderRadius: 4, fontWeight: 700, marginTop: 4 }}>
                  Scheduled on Worklist:{' '}
                  {new Date(viewDetailsItem.scheduledDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {viewDetailsItem.scheduledTime ? ` at ${viewDetailsItem.scheduledTime}` : ''}
                </div>
              )}
              {(viewDetailsItem.cancelledReason || viewDetailsItem.notDoneReason) && (
                <div style={{ padding: '6px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontWeight: 700, marginTop: 4 }}>
                  Reason for {viewDetailsItem.status === 'Cancelled' ? 'Cancellation' : 'Not Done'}:{' '}
                  {viewDetailsItem.cancelledReason || viewDetailsItem.notDoneReason}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--color-gray-200)', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => handleResubmitRequest(viewDetailsItem)}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 14px', fontWeight: 700 }}
                disabled={resubmitting}
              >
                <FiRotateCcw size={14} />
                <span>{resubmitting ? 'Resubmitting...' : 'Resubmit Request'}</span>
              </button>

              <button
                type="button"
                onClick={() => setViewDetailsItem(null)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 12, padding: '7px 16px' }}
              >
                Close
              </button>
            </div>
          </div>
        </BottomSheetModal>
      )}

      {/* --- Delete Confirmation Modal --- */}
      {deleteConfirmItem && (
        <BottomSheetModal
          open={!!deleteConfirmItem}
          onClose={() => setDeleteConfirmItem(null)}
          title="Delete Procedure Request"
          maxWidth="440px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
            <p style={{ color: 'var(--color-gray-800)', margin: 0 }}>
              Are you sure you want to delete the procedure request for{' '}
              <strong>{deleteConfirmItem.patientName}</strong> (ID: {deleteConfirmItem.hospitalID})?
            </p>
            <p style={{ color: '#ef4444', fontWeight: 600, margin: 0, fontSize: 11 }}>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 6 }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRequest}
                className="btn btn-primary btn-sm"
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </BottomSheetModal>
      )}

      {/* --- Pop-up showing Case Submitted & Generic Pre-Procedure Orders --- */}
      {submittedCaseData && (
        <BottomSheetModal
          open={!!submittedCaseData}
          onClose={() => setSubmittedCaseData(null)}
          title="Procedure Requisition Submitted"
          maxWidth="560px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Success message banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 8,
                background: '#dcfce7',
                border: '1px solid #86efac',
                color: '#166534',
              }}
            >
              <FiCheckCircle size={24} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 14.5 }}>Case Submitted Successfully!</div>
                <div style={{ fontSize: 12, marginTop: 2, opacity: 0.9 }}>
                  Request has been registered and placed in the Active Requests queue.
                </div>
              </div>
            </div>

            {/* Patient & Procedure Summary */}
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--color-gray-100)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                fontSize: 12,
              }}
            >
              <div>
                <span style={{ color: 'var(--color-gray-500)', fontSize: 11, display: 'block' }}>Patient</span>
                <strong style={{ color: 'var(--color-gray-900)', fontSize: 13 }}>{submittedCaseData.request.patientName}</strong>
                <div style={{ fontSize: 11, color: 'var(--color-gray-600)' }}>
                  ID: {submittedCaseData.request.hospitalID} {submittedCaseData.request.ward ? `• ${submittedCaseData.request.ward}` : ''}
                </div>
                {submittedCaseData.request.referringConsultant && (
                  <div style={{ fontSize: 11, color: 'var(--color-gray-600)', marginTop: 2 }}>
                    Ref: {submittedCaseData.request.referringConsultant}
                  </div>
                )}
              </div>
              <div>
                <span style={{ color: 'var(--color-gray-500)', fontSize: 11, display: 'block' }}>Procedure & Site</span>
                <strong style={{ color: 'var(--color-accent)', fontSize: 13 }}>
                  {submittedCaseData.request.procedure === 'Others' && submittedCaseData.request.otherProcedure
                    ? submittedCaseData.request.otherProcedure
                    : submittedCaseData.request.procedure}
                </strong>
                <div style={{ fontSize: 11, color: 'var(--color-gray-600)' }}>{submittedCaseData.request.fromWhere}</div>
              </div>
            </div>

            {/* Generic Pre-Procedure Orders Checklist */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                border: '1.5px solid var(--color-accent)',
                background: 'var(--color-today-bg, #eff6ff)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--color-accent)', fontWeight: 800, fontSize: 13 }}>
                <FiCheckSquare size={16} />
                <span>Generic Pre-Procedure Orders for {submittedCaseData.request.procedure}</span>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--color-gray-600)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                Please review and ensure the following pre-procedure orders are executed prior to shifting the patient:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {submittedCaseData.orders.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--color-gray-500)', fontStyle: 'italic' }}>
                    No specific generic orders configured for this procedure type.
                  </div>
                ) : (
                  submittedCaseData.orders.map((ord, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        fontSize: 12,
                        color: 'var(--color-gray-900)',
                        background: 'var(--color-white)',
                        padding: '7px 10px',
                        borderRadius: 6,
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                      }}
                    >
                      <span style={{ fontWeight: 800, color: 'var(--color-accent)', minWidth: 18 }}>{idx + 1}.</span>
                      <span style={{ lineHeight: 1.4 }}>{ord}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pop-up Close / Acknowledge button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6 }}>
              <button
                type="button"
                onClick={() => setSubmittedCaseData(null)}
                className="btn btn-primary"
                style={{ padding: '8px 24px', fontSize: 13, fontWeight: 700 }}
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </BottomSheetModal>
      )}
    </div>
  );
}
