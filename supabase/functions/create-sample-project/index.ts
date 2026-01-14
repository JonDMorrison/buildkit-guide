import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateSampleRequest {
  organizationId: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { organizationId }: CreateSampleRequest = await req.json();

    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    // Verify user is member of organization
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      throw new Error("Not a member of this organization");
    }

    // Get or create trades
    const tradeNames = ["Electrical", "Plumbing", "HVAC", "Framing", "Drywall"];
    const trades: { id: string; name: string }[] = [];

    for (const name of tradeNames) {
      const { data: existingTrade } = await supabase
        .from("trades")
        .select("id, name")
        .eq("name", name)
        .single();

      if (existingTrade) {
        trades.push(existingTrade);
      } else {
        const { data: newTrade, error: tradeError } = await supabase
          .from("trades")
          .insert({ name })
          .select("id, name")
          .single();
        
        if (newTrade) {
          trades.push(newTrade);
        }
      }
    }

    // Create sample project
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 7); // Started a week ago
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 60); // 60 days from now

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: "📋 Sample Project - Downtown Office Build",
        description: "This is a sample project to help you explore Project Path. Feel free to add tasks, create safety forms, and experiment with all features!",
        location: "123 Main Street, Downtown",
        job_number: "SAMPLE-001",
        status: "active",
        organization_id: organizationId,
        created_by: user.id,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
      })
      .select()
      .single();

    if (projectError) {
      throw projectError;
    }

    console.log("Created sample project:", project.id);

    // Add user as project manager
    await supabase
      .from("project_members")
      .insert({
        project_id: project.id,
        user_id: user.id,
        role: "project_manager",
      });

    // Create sample tasks
    const taskData = [
      { 
        title: "Complete electrical rough-in for floors 1-3", 
        trade: "Electrical", 
        status: "done",
        daysFromNow: -5,
        priority: 2
      },
      { 
        title: "Install main water lines", 
        trade: "Plumbing", 
        status: "done",
        daysFromNow: -3,
        priority: 2
      },
      { 
        title: "HVAC ductwork - Floor 2", 
        trade: "HVAC", 
        status: "in_progress",
        daysFromNow: 0,
        priority: 1
      },
      { 
        title: "Framing inspection - Conference rooms", 
        trade: "Framing", 
        status: "in_progress",
        daysFromNow: 1,
        priority: 1
      },
      { 
        title: "Drywall installation - Floor 1", 
        trade: "Drywall", 
        status: "todo",
        daysFromNow: 3,
        priority: 2
      },
      { 
        title: "Fire suppression system installation", 
        trade: "Plumbing", 
        status: "blocked",
        daysFromNow: 2,
        priority: 1
      },
      { 
        title: "Electrical panel installation", 
        trade: "Electrical", 
        status: "todo",
        daysFromNow: 5,
        priority: 2
      },
      { 
        title: "HVAC controls and thermostats", 
        trade: "HVAC", 
        status: "todo",
        daysFromNow: 7,
        priority: 3
      },
    ];

    const createdTasks: { id: string; title: string; status: string }[] = [];

    for (const task of taskData) {
      const trade = trades.find(t => t.name === task.trade);
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + task.daysFromNow);

      const { data: newTask, error: taskError } = await supabase
        .from("tasks")
        .insert({
          project_id: project.id,
          title: task.title,
          status: task.status,
          trade_id: trade?.id,
          priority: task.priority,
          due_date: dueDate.toISOString().split("T")[0],
          created_by: user.id,
        })
        .select("id, title, status")
        .single();

      if (newTask) {
        createdTasks.push(newTask);
      }
    }

    console.log(`Created ${createdTasks.length} sample tasks`);

    // Create a blocker for the blocked task
    const blockedTask = createdTasks.find(t => t.status === "blocked");
    if (blockedTask) {
      await supabase
        .from("blockers")
        .insert({
          task_id: blockedTask.id,
          reason: "Waiting for fire department permit approval",
          description: "Permit application submitted 3 days ago. Expected approval by end of week.",
          created_by: user.id,
          is_resolved: false,
        });
      
      console.log("Created sample blocker");
    }

    // Create a sample safety form (draft)
    const { error: safetyError } = await supabase
      .from("safety_forms")
      .insert({
        project_id: project.id,
        form_type: "daily_safety_log",
        title: `Daily Safety Log - ${today.toLocaleDateString()}`,
        status: "draft",
        inspection_date: today.toISOString().split("T")[0],
        created_by: user.id,
      });

    if (!safetyError) {
      console.log("Created sample safety form");
    }

    return new Response(
      JSON.stringify({
        success: true,
        projectId: project.id,
        message: "Sample project created successfully",
        tasksCreated: createdTasks.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error creating sample project:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
