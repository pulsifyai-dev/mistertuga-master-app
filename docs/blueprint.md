# **App Name**: MisterTuga Insights

## Core Features:

- Firebase Authentication: Implement user authentication with Firebase, including 'Login' and 'Sign Up' tabs with a server action for sign-up, integrated with Firebase Admin SDK for role-based claims.
- Role-Based Access Control: Implement role-based access control (ADMIN/FORNECEDOR) using Firebase Admin SDK and custom claims based on the ADMIN_CODE during registration, saving user role and email to a Firestore 'users' collection.
- Dashboard UI with Permanent Sidebar: Create a dashboard with a permanent sidebar using shadcn/ui components, displaying relevant navigation links.
- Conditional Sidebar Link: Implement conditional rendering of the 'Profit Stats' link in the sidebar, visible only to users with the 'ADMIN' role.
- Data Visualization: Ability to visualize data sets using graphs and charts

## Style Guidelines:

- Primary color: Deep purple (#624CAB) for a professional and insightful feel.
- Background color: Dark grey (#212121) for a dark-themed, modern look.
- Accent color: Teal (#30D5C8) to provide a high contrast to the main background and the primary color, so elements pop on the page.
- Headline font: 'Space Grotesk' (sans-serif) for headings.
- Body font: 'Inter' (sans-serif) for body text.
- Use consistent, professional icons from a library like 'lucide-react' for UI elements and actions.
- Utilize a responsive layout with Tailwind CSS to ensure compatibility across devices, focusing on a clean, structured design.
- Employ subtle transitions and animations for UI elements to enhance user experience without being distracting.