import { createBrowserRouter, Navigate } from 'react-router-dom';
import BasicLayout from './layouts/BasicLayout';
import KidLayout from './pages/kid/KidLayout';
import KidHome from './pages/kid/KidHome';
import KidChat from './pages/kid/KidChat';
import KidDraw from './pages/kid/KidDraw';
import KidEnglish from './pages/kid/KidEnglish';
import KidEnglishPlay from './pages/kid/KidEnglishPlay';
import KidExpression from './pages/kid/KidExpression';
import KidExpressionPlay from './pages/kid/KidExpressionPlay';
import KidStorybooks from './pages/kid/KidStorybooks';
import KidStorybookCreate from './pages/kid/KidStorybookCreate';
import KidStorybookRead from './pages/kid/KidStorybookRead';
import { KidGameLevels, KidGameList } from './pages/kid/KidGames';
import KidGamePlay from './pages/kid/KidGamePlay';
import KidStars from './pages/kid/KidStars';
import ParentArea from './pages/parent';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <KidLayout />,
    children: [
      { index: true, element: <KidHome /> },
      { path: 'chat/:chatId', element: <KidChat /> },
      { path: 'draw', element: <KidDraw /> },
      { path: 'english', element: <KidEnglish /> },
      { path: 'english/:sceneId', element: <KidEnglishPlay /> },
      { path: 'expression', element: <KidExpression /> },
      { path: 'expression/:targetId', element: <KidExpressionPlay /> },
      { path: 'books', element: <KidStorybooks /> },
      { path: 'books/new', element: <KidStorybookCreate /> },
      { path: 'books/:bookId', element: <KidStorybookRead /> },
      { path: 'games', element: <KidGameList /> },
      { path: 'games/:gameId', element: <KidGameLevels /> },
      { path: 'games/:gameId/:level', element: <KidGamePlay /> },
      { path: 'stars', element: <KidStars /> },
    ],
  },
  {
    path: '/parent',
    element: <BasicLayout />,
    children: [{ index: true, element: <ParentArea /> }],
  },
  {
    path: '/login',
    element: <Navigate to="/" replace />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
