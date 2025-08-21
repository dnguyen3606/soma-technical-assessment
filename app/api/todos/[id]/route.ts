import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: {
    id: string;
  };
}

const key = 'jKq7Dk3JZ14FhBrufz2cKiAvSgyWl89uBwGpS9u8PrAbc0uheWwkks1B' // would hide secrets in .env if this was prod. should be fine since its a free key

export async function DELETE(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    await prisma.todo.delete({
      where: { id },
    });
    return NextResponse.json({ message: 'Todo deleted' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error deleting todo' }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
    
  try {
    const todo = await prisma.todo.findUnique({ where: { id: Number(params.id) } });
    if (!todo) return NextResponse.json({ error: "Todo not found" }, { status: 400 });

    const image = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(todo.title)}&per_page=1`, {
      headers: { Authorization: key },
    });
    const data = await image.json();
    const url = data.photos?.[0]?.src?.medium || null;

    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: 'Error deleting todo' }, { status: 500 });
  }
}

// toggles a dependency on or off. If toggling on, checks for validity
export async function PATCH(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const { dependency } = await request.json();
    if (typeof dependency !== 'number') {
      return NextResponse.json({ error: 'Invalid dependency ID' }, { status: 400 });
    }

    const todo = await prisma.todo.findUnique({
      where: { id },
      include: { dependencies: true },
    });
    if (!todo) return NextResponse.json({ error: 'Todo to add dependency to not found' }, { status: 400 });

    const currentDeps = todo.dependencies.map((d) => d.id);

    let updatedDeps: { id: number }[];
    if (currentDeps.includes(dependency)) { // if dependency already exists in todo, remove it
      updatedDeps = currentDeps.filter((d) => d !== dependency).map((id) => ({ id }));
    } else { // if dep not in todo, validate to ensure no circular loops
      const validationResult = await validateDependency(id, dependency);
      if (validationResult !== true) {
        return NextResponse.json({ error: validationResult }, { status: 400 });
      }
      updatedDeps = [...currentDeps, dependency].map((id) => ({ id }));
    }

    const updatedTodo = await prisma.todo.update({
      where: { id },
      data: { dependencies: { set: updatedDeps } },
      include: { dependencies: true },
    });

    return NextResponse.json(updatedTodo);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error updating todo' }, { status: 500 });
  }
}

// Validate adding a single dependency
async function validateDependency(todoId: number, depId: number): Promise<true | string> {
  if (depId === todoId) return 'Invalid: A task can\'t be dependent on itself';

  const visited = new Set<number>();

  async function dfs(id: number): Promise<boolean> {
    if (id === todoId) return false; 
    if (visited.has(id)) return true;
    visited.add(id);

    const todo = await prisma.todo.findUnique({
      where: { id },
      include: { dependencies: true },
    });
    if (!todo) return true;

    for (const dep of todo.dependencies) {
      if (!(await dfs(dep.id))) return false;
    }
    return true;
  }

  if (!(await dfs(depId))) return 'Invalid: Adding this task would create a circular dependency.';
  return true;
}
