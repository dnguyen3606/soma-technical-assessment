"use client"
import { useState, useEffect } from 'react';
import { TodoGraph } from './components/TodoGraph';

type Todo = {
  id: number;
  title: string;
  due: Date;
  createdAt: Date;
  url?: string | null;
  dependencies?: Todo[] | null;
}

export default function Home() {
  const [newTodo, setNewTodo] = useState('');
  const [newDate, setNewDate] = useState('');
  const [todos, setTodos] = useState<Todo[]>([]);

  const [todoModal, setTodoModal] = useState<Todo | null>(null);
  const [patchingId, setPatchingId] = useState<number | null>(null);
  
  let chain: Todo[] = [];
  let earliestStart = new Date(0);


  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const res = await fetch('/api/todos');
      const data = await res.json();
      setTodos(data);
      fetchImages(data);
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    }
  };

  // every task async requests pexels for their own image
  const fetchImages = async (todos: Todo[]) => {
    try {
      for (const todo of todos) {
        fetchImage(todo.id)
      }
    } catch (error) {
      console.error('Failed to fetch images for todos:', error);
    }
  }

  // given a specific id, query for the task's title, then requests pexels for image based on title acting as task descriptor
  const fetchImage = async (id: number) => {
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'GET',
      });
      const { url } = await res.json();

      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id ? { ...todo, url: url } : todo
        )
      );
    } catch (error) {
      console.error('Failed to fetch image for task ', id, ':', error);
    }
  }

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    try {
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo, due: newDate }),
      });
      setNewTodo('');
      setNewDate('');
      fetchTodos();
    } catch (error) {
      console.error('Failed to add todo:', error);
    }
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      });
      fetchTodos();
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const handlePatchDependency = async (id: number, target: number) => {
    if (patchingId !== null) return;
    setPatchingId(target);

    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependency: target }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to update dependency');
        setPatchingId(null);
        return;
      }

      const updatedTodo: Todo = data;
      setTodos(prev => prev.map(t => (t.id === updatedTodo.id ? updatedTodo : t)));
      setTodoModal(updatedTodo);
    } catch (error) {
      console.error('Failed to patch dependency:', error);
      alert('Network error');
    } finally {
      setPatchingId(null);
    }
  };

  function getDependencyChain(root: Todo) {
    const map = new Map<number, Todo>();
    for (const t of todos) map.set(t.id, t);

    const visited = new Set<number>();
    const chain: Todo[] = [];
    let latestDue = new Date();

    function dfs(id: number) {
      if (visited.has(id)) return;
      visited.add(id);

      const node = map.get(id);
      if (!node) return; 

      const deps = node.dependencies ?? [];
      for (const d of deps) {
        if (d?.id != null) dfs(d.id);
      }

      chain.push(node);

      if (node.id !== root.id && new Date(node.due) > new Date(latestDue)) {
        latestDue = new Date(node.due);
      }
    }

    dfs(root.id);

    return {
      chain,
      earliestStart: latestDue,
    }
  }

  if (todoModal) {
    ({ chain, earliestStart } = getDependencyChain(todoModal));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-red-500 flex flex-col items-center p-4">

      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center text-white mb-8">Things To Do App</h1>
        <div className="flex mb-6">
          <input
            type="text"
            className="flex-grow p-3 rounded-l-full focus:outline-none text-gray-700"
            placeholder="Add a new todo"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
          
          />
          <input 
            type="date" 
            className="flex-grow p-3 focus:outline-none text-gray-700"
            value={newDate} 
            onChange={(e) => setNewDate(e.target.value)}
          />
          <button
            onClick={handleAddTodo}
            className="bg-white text-indigo-600 p-3 rounded-r-full hover:bg-gray-100 transition duration-300"
          >
            Add
          </button>
        </div>
        <ul>
          {todos.map((todo:Todo) => (
            <li
              key={todo.id}
              className="flex justify-between items-center bg-white bg-opacity-90 p-4 mb-4 rounded-lg shadow-lg space-x-4"
              onClick={() => setTodoModal(todo)}
            >
              <span className="text-gray-800">{todo.title}</span>
              {todo.url ? (
                <img src={todo.url} alt={todo.title} className="w-32 h-32 object-cover rounded-lg"/>
              ) : (
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
              )}
              <div className="flex items-center space-x-2">
                <span className={new Date(todo.due) > new Date() ? "text-gray-800" : "text-red-700 font-bold"}>
                  {new Date(todo.due).toLocaleDateString()}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTodo(todo.id);
                  }}
                  className="text-red-500 hover:text-red-700 transition duration-300"
                >
                  {/* Delete Icon */}
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

            </li>
          ))}
        </ul>
      </div>

      {todoModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="fixed inset-0 bg-black opacity-50" onClick={() => setTodoModal(null)}></div>
          <div className="bg-white rounded-lg p-6 z-10 max-w-lg w-full text-gray-800">
            <h2 className="text-xl font-bold mb-4">Todo: {todoModal.title}</h2>

            <div className="mb-4">
              <p>Dependencies:</p>
              <TodoGraph todos={chain} targetId={todoModal.id.toString()} />
              <p>Earliest possible start date: {new Date(earliestStart).toLocaleDateString()}</p>
            </div>

            <div className="mb-4">
              <p>Click a task to add it as a dependency:</p>
              {todos
                .filter((t) => t.id !== todoModal.id)
                .map((t) => {
                  const isDependent = todoModal.dependencies?.some((dep) => dep.id === t.id);
                  const isPending = patchingId === t.id;

                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between cursor-pointer p-2 rounded mb-1 transition
                                  ${isDependent ? "bg-orange-200" : "hover:bg-orange-100"}`}
                      onClick={() => {
                        if (isPending) return;
                        handlePatchDependency(todoModal.id, t.id);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t.title}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
