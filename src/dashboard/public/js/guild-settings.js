document.addEventListener('DOMContentLoaded', () => {
    // Handle category navigation
    const categoryButtons = document.querySelectorAll('.category-button');
    const settingsCategories = document.querySelectorAll('.settings-category');
    
    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.getAttribute('data-category');
            
            // Update active button
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show the selected category
            settingsCategories.forEach(section => {
                if (section.getAttribute('data-category') === category) {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });
        });
    });
    // Add global modal styles
    if (!document.getElementById('global-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'global-modal-styles';
        style.textContent = `
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: flex-start;
                justify-content: center;
                z-index: 9999;
                transition: opacity 0.3s ease;
                backdrop-filter: blur(5px);
                padding-top: 15vh;
            }
            
            .modal-content {
                background: var(--secondary-color);
                padding: 2rem;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                transition: transform 0.3s ease;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            }
            
            .modal h3 {
                margin: 0 0 1.5rem;
                color: var(--primary-color);
                font-size: 1.5rem;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding-bottom: 0.75rem;
            }
            
            .modal .form-group {
                margin-bottom: 1.5rem;
            }
            
            .modal .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 500;
                color: var(--text-color);
            }
            
            .modal .form-group input,
            .modal .form-group select {
                width: 100%;
                padding: 0.75rem;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: var(--background-color);
                color: var(--text-color);
                font-size: 1rem;
            }
            
            .modal .form-group input:focus,
            .modal .form-group select:focus {
                border-color: var(--primary-color);
                outline: none;
                box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.2);
            }
            
            .modal .help-text {
                display: block;
                margin-top: 0.25rem;
                font-size: 0.85rem;
                color: var(--accent-color);
            }
            
            .modal .form-actions {
                display: flex;
                gap: 1rem;
                margin-top: 2rem;
                justify-content: flex-end;
            }
            
            .modal button {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: 500;
                color: white;
            }
            
            .cancel-button {
                background: var(--accent-color);
            }
            
            .confirm-button {
                background: var(--primary-color);
            }
            
            .danger-confirm-button {
                background: var(--danger-color);
            }
            
            .modal button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            
            .modal button:active {
                transform: translateY(0);
            }
            
            .modal select option {
                background: var(--background-color);
                color: var(--text-color);
                padding: 8px;
            }
            
            .confirmation-modal .modal-message {
                background: rgba(0, 0, 0, 0.2);
                padding: 1.5rem;
                border-radius: 8px;
                margin-bottom: 1rem;
                border-left: 4px solid var(--primary-color);
            }
            
            .confirmation-modal .modal-message p {
                margin: 0;
                line-height: 1.6;
                font-size: 1.1rem;
            }
            
            .danger-input-container {
                margin-top: 1.5rem;
                padding-top: 1rem;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .confirmation-input {
                width: 100%;
                padding: 0.75rem;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: var(--background-color);
                color: var(--text-color);
                font-size: 1rem;
                margin-top: 0.5rem;
            }
            
            .confirmation-input:focus {
                border-color: var(--danger-color);
                outline: none;
                box-shadow: 0 0 0 2px rgba(237, 66, 69, 0.2);
            }
            
            .danger-confirm-button:hover {
                background: #f04747;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(237, 66, 69, 0.3);
            }
            
            .danger-confirm-button:disabled {
                background: #7a0000;
                cursor: not-allowed;
                opacity: 0.6;
                transform: none;
                box-shadow: none;
            }
            
            .confirmation-modal .modal-content {
                border-top: 4px solid var(--primary-color);
            }
            
            .confirmation-modal.danger .modal-content {
                border-top: 4px solid var(--danger-color);
            }
            
            .confirmation-modal.danger .modal-message {
                border-left: 4px solid var(--danger-color);
            }
        `;
        document.head.appendChild(style);
    }

    const settingsForm = document.getElementById('settingsForm');
    const addRoleRewardButton = document.getElementById('addRoleReward');
    const addExcludedChannelButton = document.getElementById('addExcludedChannel');
    const addExcludedRoleButton = document.getElementById('addExcludedRole');
    const resetInvitesButton = document.getElementById('resetInvitesBtn');
    
    // Add a debug button to test invite settings
    const debugButton = document.createElement('button');
    debugButton.type = 'button';
    debugButton.textContent = 'Test Invite Settings API';
    debugButton.style.display = 'none'; // Hide by default
    debugButton.classList.add('btn', 'btn-secondary', 'mt-3');
    
    // Add a health check button
    const healthButton = document.createElement('button');
    healthButton.type = 'button';
    healthButton.textContent = 'Check API Health';
    healthButton.style.display = 'none'; // Hide by default
    healthButton.classList.add('btn', 'btn-info', 'mt-3', 'ml-2');
    
    // Add an echo test button
    const echoButton = document.createElement('button');
    echoButton.type = 'button';
    echoButton.textContent = 'Test Echo API';
    echoButton.style.display = 'none'; // Hide by default
    echoButton.classList.add('btn', 'btn-warning', 'mt-3', 'ml-2');
    
    // Add debug buttons after the form
    settingsForm.after(debugButton);
    debugButton.after(healthButton);
    healthButton.after(echoButton);
    
    // Show debug buttons when pressing Ctrl+Shift+D
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            debugButton.style.display = debugButton.style.display === 'none' ? 'block' : 'none';
            healthButton.style.display = healthButton.style.display === 'none' ? 'block' : 'none';
            echoButton.style.display = echoButton.style.display === 'none' ? 'block' : 'none';
        }
    });
    
    // Add event listener to debug button
    debugButton.addEventListener('click', async () => {
        try {
            const guildId = document.querySelector('[name="guildId"]').value;
            const response = await fetch(`/guild/${guildId}/invite-settings/test`);
            const result = await response.json();
            
            console.log('Invite settings API test result:', result);
            alert(`API Test Result:\n${JSON.stringify(result, null, 2)}`);
        } catch (error) {
            console.error('Error testing invite settings API:', error);
            alert(`Error testing API: ${error.message}`);
        }
    });
    
    // Add event listener to health check button
    healthButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/invite-settings-health');
            const responseText = await response.text();
            console.log('Health check raw response:', responseText);
            
            try {
                const result = JSON.parse(responseText);
                console.log('Health check result:', result);
                alert(`API Health Check:\n${JSON.stringify(result, null, 2)}`);
            } catch (jsonError) {
                console.error('Error parsing health check response:', jsonError);
                alert(`Raw Response (not JSON):\n${responseText}`);
            }
        } catch (error) {
            console.error('Error checking API health:', error);
            alert(`Error checking API health: ${error.message}`);
        }
    });
    
    // Add event listener to echo button
    echoButton.addEventListener('click', async () => {
        try {
            const testData = {
                test: 'data',
                timestamp: Date.now(),
                boolean: true,
                number: 123
            };
            
            console.log('Sending test data to echo endpoint:', testData);
            
            const response = await fetch('/invite-settings-echo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testData)
            });
            
            const responseText = await response.text();
            console.log('Echo raw response:', responseText);
            
            try {
                const result = JSON.parse(responseText);
                console.log('Echo result:', result);
                alert(`Echo Test Result:\n${JSON.stringify(result, null, 2)}`);
            } catch (jsonError) {
                console.error('Error parsing echo response:', jsonError);
                alert(`Raw Response (not JSON):\n${responseText}`);
            }
        } catch (error) {
            console.error('Error testing echo API:', error);
            alert(`Error testing echo API: ${error.message}`);
        }
    });

    // Handle form submission with validation
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(settingsForm);
        const data = Object.fromEntries(formData);

        console.log('Form data to be submitted:', data);

        // Validate form data
        if (!validateFormData(data)) {
            showNotification('Please check your input values.', 'error');
            return;
        }

        // Handle checkboxes for boolean values
        data.enable_announcements = data.enable_announcements === 'on' ? true : false;
        data.count_fake_invites = data.count_fake_invites === 'on' ? true : false;
        data.count_left_invites = data.count_left_invites === 'on' ? true : false;
        data.enable_invite_welcome = data.enable_invite_welcome === 'on' ? true : false;
        
        console.log('Enable announcements value:', data.enable_announcements);

        try {
            // Get the active category
            const activeCategoryButton = document.querySelector('.category-button.active');
            if (!activeCategoryButton) {
                console.error('No active category found');
                showNotification('Error: Could not determine active settings category', 'error');
                return;
            }
            
            const activeCategory = activeCategoryButton.dataset.category;
            console.log('Active category:', activeCategory);
            
            // If the active category is invites, save invite settings separately
            if (activeCategory === 'invites') {
                console.log('Saving invite settings...');
                
                // Create invite settings object
                const inviteSettings = {
                    count_fake_invites: data.count_fake_invites,
                    count_left_invites: data.count_left_invites,
                    enable_invite_welcome: data.enable_invite_welcome,
                    invite_welcome_channel: data.invite_welcome_channel,
                    invite_welcome_message: data.invite_welcome_message
                };
                
                console.log('Invite settings to save:', inviteSettings);
                
                try {
                    console.log('Saving invite settings...');
                    
                    // Save invite settings
                    const inviteResponse = await fetch(`/guild/${data.guildId}/invite-settings`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(inviteSettings)
                    });
                    
                    // First get the response as text
                    const responseText = await inviteResponse.text();
                    console.log('Raw response:', responseText);
                    
                    // Check if the response is HTML (error page) or JSON
                    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
                        console.error('Server returned HTML instead of JSON:', responseText);
                        showNotification('Server error: The server returned an HTML page instead of JSON. Check server logs.', 'error');
                        return;
                    }
                    
                    // Try to parse as JSON
                    let result;
                    try {
                        result = JSON.parse(responseText);
                    } catch (jsonError) {
                        console.error('Failed to parse response as JSON:', jsonError);
                        console.error('Response text:', responseText);
                        showNotification('Error: Invalid response from server', 'error');
                        return;
                    }
                    
                    if (inviteResponse.ok && result.success) {
                        console.log('Invite settings saved successfully:', result);
                        showNotification('Invite settings saved successfully!', 'success');
                    } else {
                        console.error('Error saving invite settings:', result);
                        showNotification(result.error || 'Failed to save invite settings.', 'error');
                    }
                } catch (error) {
                    console.error('Error saving invite settings:', error);
                    console.error('Error stack:', error.stack);
                    showNotification('Network error: ' + error.message, 'error');
                }
                
                return;
            }
            
            // Otherwise, save regular settings
            console.log('Sending settings data to server:', data);
            
            const response = await fetch(`/dashboard/guild/${data.guildId}/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            let result;
            try {
                result = await response.json();
                console.log('Response from server:', result);
            } catch (jsonError) {
                console.error('Error parsing JSON response:', jsonError);
            }

            if (response.ok) {
                showNotification('Settings saved successfully!', 'success');
                updateFormValues(data);
            } else {
                showNotification(result?.error || 'Failed to save settings.', 'error');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            showNotification('An error occurred while saving settings: ' + error.message, 'error');
        }
    });

    // Handle role reward deletion with confirmation
    document.querySelectorAll('.delete-role').forEach(button => {
        button.addEventListener('click', async () => {
            const roleId = button.dataset.roleId;
            const roleName = button.dataset.roleName || "this role reward";
            const guildId = settingsForm.querySelector('[name="guildId"]').value;
            const item = button.closest('.role-reward-item');

            createConfirmationModal(
                'Delete Role Reward',
                `Are you sure you want to delete the role reward "${roleName}"?`,
                '',
                async () => {
                    try {
                        const response = await fetch(`/dashboard/guild/${guildId}/role-rewards/${roleId}`, {
                            method: 'DELETE'
                        });

                        if (response.ok) {
                            item.style.opacity = '0';
                            setTimeout(() => {
                                item.remove();
                                showNotification('Role reward deleted successfully!', 'success');
                            }, 300);
                        } else {
                            showNotification('Failed to delete role reward.', 'error');
                        }
                    } catch (error) {
                        console.error('Error deleting role reward:', error);
                        showNotification('An error occurred while deleting role reward.', 'error');
                    }
                }
            );
        });
    });

    // Handle excluded item deletion
    document.querySelectorAll('.remove-excluded').forEach(button => {
        button.addEventListener('click', async () => {
            const id = button.dataset.id;
            const type = button.dataset.type;
            const guildId = settingsForm.querySelector('[name="guildId"]').value;
            
            const endpoint = type === 'channel' 
                ? `/dashboard/guild/${guildId}/excluded-channels/${id}`
                : `/dashboard/guild/${guildId}/excluded-roles/${id}`;
            
            const itemType = type === 'channel' ? 'channel' : 'role';
            const itemName = button.dataset.name || `this ${itemType}`;
            const item = button.closest('.excluded-item');
            
            createConfirmationModal(
                `Remove Excluded ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}`,
                `Are you sure you want to remove "${itemName}" from the excluded ${itemType}s list?`,
                '',
                async () => {
                    try {
                        const response = await fetch(endpoint, {
                            method: 'DELETE'
                        });

                        if (response.ok) {
                            item.style.opacity = '0';
                            setTimeout(() => {
                                item.remove();
                                showNotification(`Excluded ${itemType} removed successfully!`, 'success');
                                
                                // Show "no items" message if list is empty
                                const list = document.getElementById(type === 'channel' ? 'excludedChannelsList' : 'excludedRolesList');
                                if (list.querySelectorAll('.excluded-item').length === 0) {
                                    const noItemsMsg = document.createElement('p');
                                    noItemsMsg.className = 'no-items';
                                    noItemsMsg.textContent = `No excluded ${itemType}s configured.`;
                                    list.appendChild(noItemsMsg);
                                }
                            }, 300);
                        } else {
                            showNotification(`Failed to remove excluded ${itemType}.`, 'error');
                        }
                    } catch (error) {
                        console.error(`Error removing excluded ${itemType}:`, error);
                        showNotification(`An error occurred while removing excluded ${itemType}.`, 'error');
                    }
                }
            );
        });
    });

    // Add role reward with improved UI
    if (addRoleRewardButton) {
        addRoleRewardButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const modal = createRoleRewardModal();
            document.body.appendChild(modal);

            setTimeout(() => {
                modal.style.opacity = '1';
                modal.querySelector('.modal-content').style.transform = 'translateY(0)';
            }, 10);
            
            return false;
        });
    }
    
    // Add excluded channel
    if (addExcludedChannelButton) {
        addExcludedChannelButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const modal = createExcludedItemModal('channel');
            document.body.appendChild(modal);

            setTimeout(() => {
                modal.style.opacity = '1';
                modal.querySelector('.modal-content').style.transform = 'translateY(0)';
            }, 10);
            
            return false;
        });
    }
    
    // Add excluded role
    if (addExcludedRoleButton) {
        addExcludedRoleButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const modal = createExcludedItemModal('role');
            document.body.appendChild(modal);

            setTimeout(() => {
                modal.style.opacity = '1';
                modal.querySelector('.modal-content').style.transform = 'translateY(0)';
            }, 10);
            
            return false;
        });
    }
    
    // Handle reset invites button
    if (resetInvitesButton) {
        resetInvitesButton.addEventListener('click', () => {
            // Get guild ID from URL if not in form
            const guildIdInput = settingsForm.querySelector('[name="guildId"]');
            const guildId = guildIdInput ? guildIdInput.value : window.location.pathname.split('/').pop();
            
            if (!guildId) {
                showNotification('Could not determine guild ID', 'error');
                return;
            }
            
            createConfirmationModal(
                'Reset All Invites',
                'Are you sure you want to reset all invite data for this server?',
                'This action cannot be undone and will delete all invite tracking information.',
                async () => {
                    try {
                        const response = await fetch(`/dashboard/guild/${guildId}/reset-invites`, {
                            method: 'POST'
                        });

                        if (response.ok) {
                            showNotification('All invite data has been reset successfully!', 'success');
                        } else {
                            showNotification('Failed to reset invite data.', 'error');
                        }
                    } catch (error) {
                        console.error('Error resetting invite data:', error);
                        showNotification('An error occurred while resetting invite data.', 'error');
                    }
                },
                true // isDangerous
            );
        });
    }

    // Create confirmation modal
    function createConfirmationModal(title, message, confirmText, confirmAction, isDanger = false) {
        const modal = document.createElement('div');
        modal.className = 'modal confirmation-modal';
        modal.style.opacity = '0';
        
        const confirmButtonClass = isDanger ? 'danger-confirm-button' : 'confirm-button';
        
        modal.innerHTML = `
            <div class="modal-content" style="transform: translateY(-20px)">
                <h3>${title}</h3>
                <div class="modal-message">
                    <p>${message}</p>
                    ${isDanger ? `
                    <div class="danger-input-container">
                        <label for="confirmation-input">Type "${confirmText}" to confirm:</label>
                        <input type="text" id="confirmation-input" class="confirmation-input" placeholder="${confirmText}" />
                    </div>
                    ` : ''}
                </div>
                <div class="form-actions">
                    <button class="cancel-button">Cancel</button>
                    <button class="${confirmButtonClass}">Confirm</button>
                </div>
            </div>
        `;
        
        // We're now using global styles defined at the top of the file
        
        // Handle modal actions
        const closeModal = () => {
            modal.style.opacity = '0';
            modal.querySelector('.modal-content').style.transform = 'translateY(-20px)';
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.cancel-button').addEventListener('click', () => {
            closeModal();
        });
        
        const confirmButton = modal.querySelector(`.${confirmButtonClass}`);
        
        if (isDanger) {
            const confirmationInput = modal.querySelector('#confirmation-input');
            confirmButton.disabled = true;
            
            confirmationInput.addEventListener('input', () => {
                confirmButton.disabled = confirmationInput.value !== confirmText;
            });
        }
        
        confirmButton.addEventListener('click', async () => {
            if (isDanger) {
                const confirmationInput = modal.querySelector('#confirmation-input');
                if (confirmationInput.value !== confirmText) {
                    return;
                }
            }
            
            closeModal();
            await confirmAction();
        });
        
        document.body.appendChild(modal);
        
        // Animate modal opening
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.querySelector('.modal-content').style.transform = 'translateY(0)';
        }, 10);
        
        return modal;
    }
    
    // Handle reset buttons
    const resetLevelsBtn = document.getElementById('resetLevelsBtn');
    const resetAllBtn = document.getElementById('resetAllBtn');
    
    if (resetLevelsBtn) {
        resetLevelsBtn.addEventListener('click', async () => {
            const guildId = settingsForm.querySelector('[name="guildId"]').value;
            
            createConfirmationModal(
                'Reset User Levels',
                'Are you sure you want to reset all user levels and XP? This action cannot be undone.',
                '',
                async () => {
                    try {
                        const response = await fetch(`/dashboard/guild/${guildId}/reset`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ resetType: 'levels' })
                        });
                        
                        if (response.ok) {
                            showNotification('All user levels and XP have been reset successfully!', 'success');
                        } else {
                            const result = await response.json();
                            showNotification(result?.error || 'Failed to reset user levels.', 'error');
                        }
                    } catch (error) {
                        console.error('Error resetting user levels:', error);
                        showNotification('An error occurred while resetting user levels.', 'error');
                    }
                }
            );
        });
    }
    
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', async () => {
            const guildId = settingsForm.querySelector('[name="guildId"]').value;
            
            createConfirmationModal(
                'Reset All Server Data',
                'This will delete ALL bot data for this server and restore default settings. This action cannot be undone!',
                'RESET',
                async () => {
                    try {
                        const response = await fetch(`/dashboard/guild/${guildId}/reset`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ resetType: 'all' })
                        });
                        
                        if (response.ok) {
                            showNotification('All bot data has been reset successfully! The page will reload with default settings.', 'success');
                            
                            // Reload the page after a short delay to show the notification
                            setTimeout(() => {
                                window.location.reload();
                            }, 2000);
                        } else {
                            const result = await response.json();
                            showNotification(result?.error || 'Failed to reset bot data.', 'error');
                        }
                    } catch (error) {
                        console.error('Error resetting bot data:', error);
                        showNotification('An error occurred while resetting bot data.', 'error');
                    }
                },
                true // isDanger = true
            );
        });
    }

    // Form validation
    function validateFormData(data) {
        const numberFields = [
            'min_xp_per_message',
            'max_xp_per_message',
            'min_xp_per_voice_minute',
            'max_xp_per_voice_minute',
            'min_voice_minutes_to_earn',
            'max_voice_minutes_to_earn',
            'message_cooldown',
            'voice_cooldown',
            'xp_multiplier'
        ];

        for (const field of numberFields) {
            if (data[field]) {
                const value = Number(data[field]);
                if (isNaN(value) || value < 0) {
                    console.error(`Validation failed for field ${field}: ${data[field]}`);
                    return false;
                }
            }
        }

        return true;
    }

    // Update form values after successful save
    function updateFormValues(data) {
        console.log('Updating form values with:', data);
        Object.entries(data).forEach(([key, value]) => {
            const element = settingsForm.querySelector(`[name="${key}"]`);
            if (element) {
                if (element.type === 'checkbox') {
                    const isChecked = value === 'true' || value === true || value === 'on' || value === 1;
                    console.log(`Setting checkbox ${key} to ${isChecked} (original value: ${value})`);
                    element.checked = isChecked;
                } else {
                    element.value = value;
                }
            }
        });
    }

    // Create modal for adding excluded item (channel or role)
    function createExcludedItemModal(type) {
        const itemsData = type === 'channel' 
            ? (window.serverChannels || [])
            : (window.serverRoles || []);
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.opacity = '0';
        
        let optionsHTML = `<option value="">Select a ${type}</option>`;
        
        if (itemsData && itemsData.length > 0) {
            itemsData.forEach(item => {
                if (type === 'channel') {
                    const prefix = item.type === 'voice' ? '🔊' : '#';
                    optionsHTML += `<option value="${item.id}" data-type="${item.type}">${prefix} ${item.name}</option>`;
                } else {
                    optionsHTML += `<option value="${item.id}" data-color="${item.color}">${item.name}</option>`;
                }
            });
        } else {
            optionsHTML += `<option value="" disabled>No ${type}s available</option>`;
        }
        
        const title = type === 'channel' ? 'Add No XP Channel' : 'Add No XP Role';
        const selectId = type === 'channel' ? 'selectChannel' : 'selectRole';
        const helpText = type === 'channel' 
            ? 'Users will not earn XP in this channel' 
            : 'Users with this role will not earn XP';
        
        modal.innerHTML = `
            <div class="modal-content" style="transform: translateY(-20px)">
                <h3>${title}</h3>
                <div class="form-group">
                    <label for="${selectId}">Select ${type.charAt(0).toUpperCase() + type.slice(1)}</label>
                    <select id="${selectId}" required>
                        ${optionsHTML}
                    </select>
                    <small class="help-text">${helpText}</small>
                </div>
                <div class="form-actions">
                    <button type="button" class="cancel-button">Cancel</button>
                    <button type="button" class="confirm-button">Add</button>
                </div>
            </div>
        `;
        
        // We're now using global styles defined at the top of the file
        
        // Handle modal actions
        const closeModal = () => {
            modal.style.opacity = '0';
            modal.querySelector('.modal-content').style.transform = 'translateY(-20px)';
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.cancel-button').addEventListener('click', (e) => {
            e.preventDefault();
            closeModal();
        });
        modal.querySelector('.confirm-button').addEventListener('click', async (e) => {
            e.preventDefault();
            const select = document.getElementById(selectId);
            const itemId = select.value;
            
            if (!itemId) {
                showNotification(`Please select a ${type}.`, 'error');
                return;
            }
            
            const guildId = document.querySelector('[name="guildId"]').value;
            const endpoint = type === 'channel' 
                ? `/dashboard/guild/${guildId}/excluded-channels`
                : `/dashboard/guild/${guildId}/excluded-roles`;
            
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        [type === 'channel' ? 'channel_id' : 'role_id']: itemId
                    })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    closeModal();
                    showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} excluded successfully!`, 'success');
                    location.reload();
                } else {
                    showNotification(`Failed to exclude ${type}: ${result.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error(`Error excluding ${type}:`, error);
                showNotification(`An error occurred while excluding ${type}.`, 'error');
            }
        });
        
        return modal;
    }

    // Create modal for adding role reward
    function createRoleRewardModal() {
        const rolesData = window.serverRoles || [];
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.opacity = '0';
        
        let roleOptionsHTML = '<option value="">Select a role</option>';
        
        if (rolesData && rolesData.length > 0) {
            rolesData.forEach(role => {
                roleOptionsHTML += `<option value="${role.id}" data-color="${role.color}">${role.name}</option>`;
            });
        } else {
            roleOptionsHTML += '<option value="" disabled>No roles available</option>';
        }
        
        modal.innerHTML = `
            <div class="modal-content" style="transform: translateY(-20px)">
                <h3>Add Role Reward</h3>
                <div class="form-group">
                    <label for="selectRole">Select Role</label>
                    <select id="selectRole" required class="role-select">
                        ${roleOptionsHTML}
                    </select>
                    <small class="help-text">Choose a Discord role to award</small>
                </div>
                <div class="form-group">
                    <label for="roleLevel">Level Requirement</label>
                    <input type="number" id="roleLevel" min="1" required>
                    <small class="help-text">At what level this role will be awarded</small>
                </div>
                <div class="form-group">
                    <label for="roleType">Reward Type</label>
                    <select id="roleType" required>
                        <option value="chat">Chat</option>
                        <option value="voice">Voice</option>
                        <option value="both">Both</option>
                    </select>
                    <small class="help-text">Which leveling type triggers this reward</small>
                </div>
                <div class="form-actions">
                    <button type="button" class="cancel-button">Cancel</button>
                    <button type="button" class="confirm-button">Add Reward</button>
                </div>
            </div>
        `;

        // We're now using global styles defined at the top of the file

        // Handle modal actions
        const closeModal = () => {
            modal.style.opacity = '0';
            modal.querySelector('.modal-content').style.transform = 'translateY(-20px)';
            setTimeout(() => modal.remove(), 300);
        };

        modal.querySelector('.cancel-button').addEventListener('click', (e) => {
            e.preventDefault();
            closeModal();
        });
        modal.querySelector('.confirm-button').addEventListener('click', async (e) => {
            e.preventDefault();
            const roleSelect = document.getElementById('selectRole');
            const level = document.getElementById('roleLevel').value;
            const type = document.getElementById('roleType').value;
            
            if (!roleSelect.value) {
                showNotification('Please select a role.', 'error');
                return;
            }
            
            if (!level) {
                showNotification('Please enter a level requirement.', 'error');
                return;
            }

            const selectedOption = roleSelect.options[roleSelect.selectedIndex];
            const roleName = selectedOption ? selectedOption.text : 'Unknown Role';
            
            const guildId = settingsForm.querySelector('[name="guildId"]').value;
            
            try {
                console.log('Sending role reward data:', {
                    level: parseInt(level),
                    type,
                    role_id: roleSelect.value,
                    role_name: roleName,
                    stack: true
                });
                
                const response = await fetch(`/dashboard/guild/${guildId}/role-rewards`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        level: parseInt(level),
                        type,
                        role_id: roleSelect.value,
                        role_name: roleName,
                        stack: true
                    })
                });

                const result = await response.json();
                console.log('Response from server:', result);

                if (response.ok) {
                    closeModal();
                    showNotification('Role reward added successfully!', 'success');
                    location.reload();
                } else {
                    showNotification(`Failed to add role reward: ${result.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error('Error adding role reward:', error);
                showNotification('An error occurred while adding role reward: ' + error.message, 'error');
            }
        });

        return modal;
    }

    // Show notification function
    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Add smooth transitions for interactive elements
    const interactiveElements = document.querySelectorAll('button, .toggle-switch, input, select');
    
    interactiveElements.forEach(element => {
        element.addEventListener('mouseenter', () => {
            element.style.transform = 'scale(1.02)';
        });
        
        element.addEventListener('mouseleave', () => {
            element.style.transform = 'scale(1)';
        });
    });
});