import { I18nextProvider } from 'react-i18next';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './routes';
import { useTheme } from './hooks/use-theme';
import { i18n } from './i18n';

function App() {
  const { resolvedTheme } = useTheme();

  return (
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          style: {
            fontSize: '14px',
            fontWeight: '500',
          },
        }}
        theme={resolvedTheme}
      />
    </I18nextProvider>
  );
}

export default App;
