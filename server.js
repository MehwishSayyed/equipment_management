require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../public'));

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// Test Supabase connection
(async () => {
    const { data, error } = await supabase.from('equipment').select('count');
    if (error) {
        console.error('❌ Supabase connection failed:', error.message);
    } else {
        console.log('✅ Supabase connected successfully');
    }
})();

// ==================== EQUIPMENT ROUTES ====================

// Get all equipment
app.get('/api/equipment', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('equipment')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single equipment
app.get('/api/equipment/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('equipment')
            .select('*')
            .eq('id', req.params.id)
            .single();
        
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(404).json({ error: 'Equipment not found' });
    }
});

// Add new equipment
app.post('/api/equipment', async (req, res) => {
    try {
        const { name, model, serial_number, quantity, category } = req.body;
        const { data, error } = await supabase
            .from('equipment')
            .insert([{ name, model, serial_number, quantity, category }])
            .select();
        
        if (error) throw error;
        res.status(201).json({ id: data[0].id, message: 'Equipment added successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update equipment
app.put('/api/equipment/:id', async (req, res) => {
    try {
        const { name, model, serial_number, quantity, category } = req.body;
        const { error } = await supabase
            .from('equipment')
            .update({ name, model, serial_number, quantity, category })
            .eq('id', req.params.id);
        
        if (error) throw error;
        res.json({ message: 'Equipment updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete equipment
app.delete('/api/equipment/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('equipment')
            .delete()
            .eq('id', req.params.id);
        
        if (error) throw error;
        res.json({ message: 'Equipment deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== MACHINES ROUTES ====================

// Get all machines
app.get('/api/machines', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('machines')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new machine
app.post('/api/machines', async (req, res) => {
    try {
        const { machine_name, model, location, status } = req.body;
        const { data, error } = await supabase
            .from('machines')
            .insert([{ machine_name, model, location, status: status || 'working' }])
            .select();
        
        if (error) throw error;
        res.status(201).json({ id: data[0].id, message: 'Machine added successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update machine
app.put('/api/machines/:id', async (req, res) => {
    try {
        const { machine_name, model, location, status } = req.body;
        const { error } = await supabase
            .from('machines')
            .update({ machine_name, model, location, status })
            .eq('id', req.params.id);
        
        if (error) throw error;
        res.json({ message: 'Machine updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete machine
app.delete('/api/machines/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('machines')
            .delete()
            .eq('id', req.params.id);
        
        if (error) throw error;
        res.json({ message: 'Machine deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== REPAIR ORDERS ROUTES ====================

// Get all repair orders with machine details
app.get('/api/repairs', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('repair_orders')
            .select(`
                *,
                machines (
                    machine_name,
                    model,
                    location
                )
            `)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Flatten the response
        const formatted = data.map(r => ({
            ...r,
            machine_name: r.machines.machine_name,
            model: r.machines.model,
            location: r.machines.location
        }));
        
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single repair order with equipment details
app.get('/api/repairs/:id', async (req, res) => {
    try {
        const { data: repair, error: repairError } = await supabase
            .from('repair_orders')
            .select(`
                *,
                machines (
                    machine_name,
                    model,
                    location
                )
            `)
            .eq('id', req.params.id)
            .single();
        
        if (repairError) throw repairError;

        const { data: equipmentOrders, error: eqError } = await supabase
            .from('equipment_orders')
            .select(`
                *,
                equipment (
                    name,
                    model,
                    category
                )
            `)
            .eq('repair_order_id', req.params.id);
        
        if (eqError) throw eqError;

        res.json({ 
            ...repair, 
            machine_name: repair.machines.machine_name,
            equipment_orders: equipmentOrders 
        });
    } catch (err) {
        res.status(404).json({ error: 'Repair order not found' });
    }
});

// Create new repair order
app.post('/api/repairs', async (req, res) => {
    try {
        const { machine_id, issue_description, equipment_orders } = req.body;
        
        // Insert repair order
        const { data: repair, error: repairError } = await supabase
            .from('repair_orders')
            .insert([{ 
                machine_id, 
                issue_description, 
                status: 'pending' 
            }])
            .select();
        
        if (repairError) throw repairError;
        
        const repairOrderId = repair[0].id;

        // Update machine status
        await supabase
            .from('machines')
            .update({ status: 'needs_repair' })
            .eq('id', machine_id);

        // Insert equipment orders if provided
        if (equipment_orders && equipment_orders.length > 0) {
            const equipmentData = equipment_orders.map(eq => ({
                repair_order_id: repairOrderId,
                equipment_id: eq.equipment_id,
                quantity_needed: eq.quantity_needed,
                status: 'ordered'
            }));

            await supabase
                .from('equipment_orders')
                .insert(equipmentData);
        }

        res.status(201).json({ id: repairOrderId, message: 'Repair order created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update repair order status
app.put('/api/repairs/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const completedAt = status === 'completed' ? new Date().toISOString() : null;

        const { error } = await supabase
            .from('repair_orders')
            .update({ status, completed_at: completedAt })
            .eq('id', req.params.id);

        if (error) throw error;

        // If completed, update machine status
        if (status === 'completed') {
            const { data: repair } = await supabase
                .from('repair_orders')
                .select('machine_id')
                .eq('id', req.params.id)
                .single();
            
            if (repair) {
                await supabase
                    .from('machines')
                    .update({ status: 'working' })
                    .eq('id', repair.machine_id);
            }
        }

        res.json({ message: 'Repair order updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== DASHBOARD STATS ====================

app.get('/api/stats', async (req, res) => {
    try {
        const { count: equipmentCount } = await supabase
            .from('equipment')
            .select('*', { count: 'exact', head: true });

        const { count: machineCount } = await supabase
            .from('machines')
            .select('*', { count: 'exact', head: true });

        const { count: pendingRepairs } = await supabase
            .from('repair_orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        const { count: activeRepairs } = await supabase
            .from('repair_orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'in_progress');

        res.json({
            total_equipment: equipmentCount || 0,
            total_machines: machineCount || 0,
            pending_repairs: pendingRepairs || 0,
            active_repairs: activeRepairs || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});