import { Component } from '../base/Component.js';
import PropTypes from '../../lib/PropTypes';
import ListPropType from '../../lib/prop-types/ListPropType';

class SortableList extends Component {
  constructor(props = {}) {
    super(props);
    this.props = {
      sortById: props.sortById,
      items: props.items || [],
      idField: props.idField,
      onSortEnd: props.onSortEnd,
      className: props.className,
      valueDistance: props.valueDistance || 0,
      component: props.component,
      sortableRef: props.sortableRef,
      getContainerElement: props.getContainerElement,
      ...props
    };
    this.draggedElement = null;
    this.placeholder = null;
  }

  onDragStart = (e) => {
    this.draggedElement = e.target;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    e.target.style.opacity = '0.5';
  };

  onDragEnd = (e) => {
    e.target.style.opacity = '1';
    this.draggedElement = null;
    if (this.placeholder) {
      this.placeholder.remove();
      this.placeholder = null;
    }
  };

  onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const afterElement = this.getDragAfterElement(e.clientY);
    const container = e.currentTarget;
    if (afterElement == null) {
      container.appendChild(this.draggedElement);
    } else {
      container.insertBefore(this.draggedElement, afterElement);
    }
  };

  onDrop = (e) => {
    e.preventDefault();
    const container = e.currentTarget;
    const items = Array.from(container.children);
    const oldIndex = this.props.items.findIndex(item => item[this.props.idField] === this.draggedElement.dataset.id);
    const newIndex = items.indexOf(this.draggedElement);
    if (oldIndex !== newIndex) {
      const newItems = [...this.props.items];
      const [removed] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, removed);
      this.props.onSortEnd({ oldIndex, newIndex }, e);
    }
  };

  getDragAfterElement = (y) => {
    const draggableElements = [...this.element.querySelectorAll('.sortable-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  };

  render() {
    const ul = document.createElement('ul');
    ul.className = this.props.className || '';
    if (this.props.sortableRef) {
      this.props.sortableRef.current = ul;
    }
    ul.addEventListener('dragover', this.onDragOver);
    ul.addEventListener('drop', this.onDrop);

    this.props.items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'sortable-item';
      li.draggable = true;
      li.dataset.id = item[this.props.idField] || item[this.props.sortById];
      li.addEventListener('dragstart', this.onDragStart);
      li.addEventListener('dragend', this.onDragEnd);

      const component = new this.props.component({ item, ...this.props });
      li.appendChild(component.render());
      ul.appendChild(li);
    });

    return ul;
  }
}

export default SortableList;
