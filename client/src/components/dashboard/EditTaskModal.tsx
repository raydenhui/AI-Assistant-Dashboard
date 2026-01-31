import { useState, useEffect } from 'react';
import { Modal, ModalFooter, ModalButton } from '../common/Modal';
import { useTasksStore } from '../../store';
import { toast } from '../common/Toast';
import type { Task, TaskPriority, TaskStatus } from '../../types';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
}

export function EditTaskModal({ isOpen, onClose, task }: EditTaskModalProps) {
  const { updateTask } = useTasksStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (task) {
      const localDate = task.dueDate ? new Date(new Date(task.dueDate).getTime() - new Date(task.dueDate).getTimezoneOffset() * 60000) : null;
      setFormData({
        title: task.title || '',
        description: task.description || '',
        date: localDate ? localDate.toISOString().split('T')[0] : '',
        time: localDate ? localDate.toISOString().split('T')[1].slice(0, 5) : '',
      });
    }
  }, [task]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

      await updateTask(task.id, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        dueDate: combinedDueDate,
      });
      toast.success('Task updated successfully');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Task" size="md">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="edit-title" className="form-label">
            Title <span className="text-danger">*</span>
          </label>
          <input
            id="edit-title"
            name="title"
            type="text"
            value={formData.title}
            onChange={handleChange}
            className={`form-input ${errors.title ? 'border-danger' : ''}`}
          />
          {errors.title && <p className="form-error">{errors.title}</p>}
        </div>

        <div className="mb-4">
          <label htmlFor="edit-description" className="form-label">
            Description
          </label>
          <textarea
            id="edit-description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="form-textarea"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="edit-date" className="form-label">
              Due Date
            </label>
            <input
              id="edit-date"
              name="date"
              type="date"
              value={formData.date}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div>
            <label htmlFor="edit-time" className="form-label">
              Time
            </label>
            <input
              id="edit-time"
              name="time"
              type="time"
              value={formData.time}
              onChange={handleChange}
              className="form-input"
            />
          </div>
        </div>


        <ModalFooter>
          <ModalButton type="button" variant="secondary" onClick={onClose}>
            Cancel
          </ModalButton>
          <ModalButton type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  );
}
