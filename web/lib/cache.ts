import { QueryClient } from '@tanstack/react-query';

export async function invalidateTaskCaches(
  queryClient: QueryClient,
  taskId?: string,
) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    queryClient.invalidateQueries({ queryKey: ['calendar'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['my-day'] }),
    queryClient.invalidateQueries({ queryKey: ['my-day-suggestions'] }),
    queryClient.invalidateQueries({ queryKey: ['search'] }),
    queryClient.invalidateQueries({ queryKey: ['projects'] }),
  ];

  if (taskId) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: ['task', taskId] }));
  }

  await Promise.all(invalidations);
}
