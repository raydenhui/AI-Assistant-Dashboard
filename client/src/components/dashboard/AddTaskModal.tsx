import { useState } from 'react';
import { Modal, ModalFooter, ModalButton } from '../common/Modal';
import { useTasksStore } from '../../store';
import { toast } from '../common/Toast';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddTaskModal({ isOpen, onClose }: AddTaskModalProps) {
  const { createTask } = useTasksStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when field is edited
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      let combinedDueDate = undefined;
      if (formData.date) {
        combinedDueDate = new Date(`${formData.date}T${formData.time || '00:00'}`).toISOString();
      }

      await createTask({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        dueDate: combinedDueDate,
        priority: 'medium',
        source: 'manual',
      });
      toast.success('Task created successfully');
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form on close
    setFormData({
      title: '',
      description: '',
      date: '',
      time: '',
    });
    setErrors({});
    onClose();
  };

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Task" size="md">
      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div className="mb-4">
          <label htmlFor="title" className="form-label">
            Title <span className="text-danger">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter task title"
            className={`form-input ${errors.title ? 'border-danger' : ''}`}
            autoFocus
          />
          {errors.title && <p className="form-error">{errors.title}</p>}
        </div>

        {/* Description */}
        <div className="mb-4">
          <label htmlFor="description" className="form-label">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Add a description (optional)"
            className="form-textarea"
            rows={3}
          />
        </div>

        {/* Due Date and Priority row */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="date" className="form-label">
              Due Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              value={formData.date}
              onChange={handleChange}
              min={today}
              className="form-input"
            />
          </div>

          <div>
            <label htmlFor="time" className="form-label">
              Time
            </label>
            <input
              id="time"
              name="time"
              type="time"
              value={formData.time}
              onChange={handleChange}
              className="form-input"
            />
          </div>
        </div>

        <ModalFooter>
          <ModalButton type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </ModalButton>
          <ModalButton type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Creating...
              </>
            ) : (
              <>
                <i className="fas fa-plus mr-2"></i>
                Add Task
              </>
            )}
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export default AddTaskModal;
