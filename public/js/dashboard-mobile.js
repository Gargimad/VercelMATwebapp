// Mobile sidebar functionality
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.querySelector('.sidebar');
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    const closeBtn = document.querySelector('.close-sidebar-btn');
    
    // Toggle sidebar
    function toggleSidebar() {
        if (sidebar) {
            sidebar.classList.toggle('mobile-open');
        }
    }
    
    // Close sidebar
    function closeSidebar() {
        if (sidebar) {
            sidebar.classList.remove('mobile-open');
        }
    }
    
    // Add click event to hamburger button
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', toggleSidebar);
    }
    
    // Add click event to close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSidebar);
    }
    
    // Close sidebar when clicking outside
    document.addEventListener('click', function(event) {
        if (window.innerWidth <= 768 && sidebar) {
            if (!sidebar.contains(event.target) && 
                !hamburgerBtn.contains(event.target)) {
                closeSidebar();
            }
        }
    });
    
    // Close sidebar when clicking a link
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });
    
    // Close sidebar when pressing Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && window.innerWidth <= 768) {
            closeSidebar();
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768 && sidebar) {
            sidebar.classList.remove('mobile-open');
        }
    });
});