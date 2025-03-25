// Function to load timeline data from XML
function loadTimelineData() {
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            generateTimeline(this);
        }
    };
    xhr.open("GET", "timeline.xml", true);
    xhr.send();
}

// Function to generate timeline HTML from XML data
function generateTimeline(xml) {
    const xmlDoc = xml.responseXML;
    const events = xmlDoc.getElementsByTagName("event");
    const timelineContainer = document.querySelector('.timeline-container');
    
    // Clear existing timeline items
    timelineContainer.innerHTML = '';
    
    // Create timeline items from XML data
    for (let i = 0; i < events.length; i++) {
        const date = events[i].getElementsByTagName("date")[0].textContent;
        const title = events[i].getElementsByTagName("title")[0].textContent;
        const description = events[i].getElementsByTagName("description")[0].textContent;
        
        // Create timeline item
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';
        
        timelineItem.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="timeline-date">${date}</div>
            <div class="timeline-content">
                <h3>${title}</h3>
                <p>${description}</p>
            </div>
        `;
        
        timelineContainer.appendChild(timelineItem);
    }
    
    // Re-initialize timeline animations
    initTimelineAnimations();
}

// Function to initialize timeline animations
function initTimelineAnimations() {
    const timelineItems = document.querySelectorAll('.timeline-item');
    
    function checkTimelineItems() {
        timelineItems.forEach(item => {
            const itemTop = item.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            if (itemTop < windowHeight * 0.8) {
                item.classList.add('show');
            }
        });
    }
    
    // Check timeline items on initial load
    checkTimelineItems();
    
    // Check timeline items on scroll
    window.addEventListener('scroll', checkTimelineItems);
}

// Load timeline data when the page loads
document.addEventListener('DOMContentLoaded', loadTimelineData); 