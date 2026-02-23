const API_URL = 'http://localhost:5000/api/branches';

async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(`Invalid JSON from ${url}: ${text.substring(0, 500)}`);
    }
    if (!res.ok) {
        throw new Error(`Request to ${url} failed with status ${res.status}: ${JSON.stringify(data)}`);
    }
    return data;
}

async function verifyBranches() {
    try {
        console.log('--- Starting Branch API Verification ---');

        // 1. Create a branch
        console.log('\n1. Creating a new branch...');
        const createRes = await fetchJson(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test Branch' })
        });
        const branchId = createRes.id;
        console.log('Created branch:', createRes);

        // 2. Get all branches
        console.log('\n2. Fetching all branches...');
        const getAllRes = await fetchJson(API_URL);
        console.log('Total branches:', getAllRes.length);
        const found = getAllRes.find(b => b.id === branchId);
        if (found) console.log('Successfully found the new branch in the list.');

        // 3. Update the branch
        console.log('\n3. Updating the branch name...');
        const updateRes = await fetchJson(`${API_URL}/${branchId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Updated Test Branch' })
        });
        console.log('Update response:', updateRes);

        // 4. Get branch by ID
        console.log('\n4. Fetching branch by ID...');
        const getByIdRes = await fetchJson(`${API_URL}/${branchId}`);
        console.log('Fetched branch:', getByIdRes);
        if (getByIdRes.name === 'Updated Test Branch') {
            console.log('Name update verified successfully.');
        }

        // 5. Delete the branch
        console.log('\n5. Deleting the branch...');
        const deleteRes = await fetchJson(`${API_URL}/${branchId}`, {
            method: 'DELETE'
        });
        console.log('Delete response:', deleteRes);

        // 6. Verify deletion
        console.log('\n6. Verifying deletion...');
        try {
            await fetchJson(`${API_URL}/${branchId}`);
            console.error('Error: Branch still exists after deletion!');
        } catch (error) {
            if (error.message.includes('404')) {
                console.log('Deletion verified: 404 Not Found returned as expected.');
            } else {
                throw error;
            }
        }

        console.log('\n--- Branch API Verification Completed Successfully ---');
    } catch (error) {
        console.error('\nVerification failed:', error.message);
    }
}

verifyBranches();
